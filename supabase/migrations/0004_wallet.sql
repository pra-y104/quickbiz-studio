-- 0004_wallet.sql
-- Stage 7: wallet persistence (prepared, NOT applied automatically).
--
-- This migration turns the pure ledger in packages/shared/src/wallet/ledger.ts into
-- durable tables with row-level security. It mirrors the ledger's rules exactly:
--   * money is integer minor units of one ISO currency;
--   * balances are derived from an append-only list of entries, never a stored number;
--   * duplicate entry ids are refused (idempotency);
--   * a currency mismatch is refused (a wallet holds one currency);
--   * a debit or reserve that would exceed available balance (balance minus active
--     reservations) is refused;
--   * a reservation holds funds without changing the balance;
--   * releases are full-release only: a release must match the outstanding amount of
--     its original reservation and cannot release more than reserved;
--   * compensation entries use kind 'compensation' with distinct reference prefix
--     'comp:' to separate internal wallet compensation from payment settlements.
--
-- Access model:
--   * a customer may READ their own wallet and entries;
--   * a customer may RESERVE and RELEASE their own funds (full-release only);
--   * only the service role (the Worker, after a verified payment or an AI run)
--     may CREDIT, DEBIT, REFUND or COMPENSATE — a browser can never invent money.
--
-- APPLY THIS ONLY AFTER OWNER APPROVAL. It is not applied by the build or by tests.

-- ---------------------------------------------------------------------------
-- Wallets
-- ---------------------------------------------------------------------------

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_currency_iso check (currency ~ '^[A-Z]{3}$')
);

comment on table public.wallets is
  'One wallet per user. Holds one currency; balances are derived from wallet_entries.';

alter table public.wallets enable row level security;

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
  on public.wallets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert/update/delete policies for clients: a wallet is created on first credit
-- by the service role and is otherwise immutable from the browser.

revoke all on public.wallets from public, anon, authenticated;
grant select on public.wallets to authenticated;

-- ---------------------------------------------------------------------------
-- Ledger entries (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.wallet_entries (
  id text primary key,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  kind text not null check (kind in ('credit', 'debit', 'reserve', 'release', 'refund', 'compensation')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reference text not null default '',
  created_at timestamptz not null default now(),
  constraint wallet_entries_amount_safe check (amount_minor <= 9007199254740991)
);

comment on table public.wallet_entries is
  'Append-only ledger. One row per credit/debit/reserve/release/refund/compensation. The id is the idempotency key.';

create index if not exists wallet_entries_wallet_created_idx
  on public.wallet_entries (wallet_id, created_at desc);

alter table public.wallet_entries enable row level security;

drop policy if exists "wallet_entries_select_own" on public.wallet_entries;
create policy "wallet_entries_select_own"
  on public.wallet_entries
  for select
  to authenticated
  using (
    exists (
      select 1 from public.wallets w
      where w.id = wallet_entries.wallet_id and w.user_id = (select auth.uid())
    )
  );

-- No client insert/update/delete: every mutation goes through the functions below.

revoke all on public.wallet_entries from public, anon, authenticated;
grant select on public.wallet_entries to authenticated;

-- Append-only guard. Corrections are new compensating rows, never updates or deletes.
drop trigger if exists wallet_entries_reject_mutation on public.wallet_entries;
create trigger wallet_entries_reject_mutation
  before update or delete on public.wallet_entries
  for each row execute function public.reject_mutation();

-- ---------------------------------------------------------------------------
-- Balance read helpers (SECURITY INVOKER — RLS enforces ownership for callers)
-- ---------------------------------------------------------------------------

-- Current balance: credits + refunds + compensations - debits. Reserves/releases do not move it.
create or replace function public.wallet_balance_minor(p_wallet_id uuid)
returns bigint
language sql
stable
security invoker
as $$
  select coalesce(sum(
    case
      when kind in ('credit', 'refund', 'compensation') then amount_minor
      when kind = 'debit' then -amount_minor
      else 0
    end
  ), 0)
  from public.wallet_entries
  where wallet_id = p_wallet_id;
$$;

-- Net active reservations (reserve minus release).
create or replace function public.wallet_reserved_minor(p_wallet_id uuid)
returns bigint
language sql
stable
security invoker
as $$
  select greatest(0, coalesce(sum(
    case
      when kind = 'reserve' then amount_minor
      when kind = 'release' then -amount_minor
      else 0
    end
  ), 0))
  from public.wallet_entries
  where wallet_id = p_wallet_id;
$$;

-- ---------------------------------------------------------------------------
-- Core insert with ledger invariants (SECURITY DEFINER — internal only)
-- ---------------------------------------------------------------------------

-- This function is intentionally NOT granted to any role. It is called only
-- internally by other SECURITY DEFINER functions (wallet_credit, wallet_debit,
-- wallet_refund, wallet_compensate, wallet_reserve, wallet_release) which execute
-- as the owner (postgres) and always have implicit EXECUTE privilege on their own
-- functions. Direct execution by PUBLIC, anon, authenticated, or service_role is
-- impossible.
--
-- Balance calculation order (security-critical):
--   1. Lock the wallet row.
--   2. Verify currency match.
--   3. Check idempotency on the proposed entry id BEFORE inserting.
--   4. For debit/reserve: calculate existing balance and existing reservations
--      from CURRENT rows ONLY (the proposed entry is NOT yet inserted).
--   5. Check available balance = existing balance - existing reservations.
--   6. Insert the ledger row only after all applicable checks pass.
--
-- This ordering prevents the proposed entry from being counted in its own
-- balance check, which would incorrectly accept overdrafts or reject valid
-- transactions.

create or replace function public.wallet_insert_entry(
  p_wallet_id uuid,
  p_id text,
  p_kind text,
  p_amount_minor bigint,
  p_currency text,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet_currency text;
  v_balance bigint;
  v_reserved bigint;
  v_existing_wallet_id uuid;
  v_existing_kind text;
  v_existing_amount bigint;
  v_existing_currency text;
  v_existing_reference text;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'amount must be a positive integer' using errcode = 'check_violation';
  end if;

  -- Lock the wallet row FIRST to serialize concurrent mutations on the same wallet.
  select currency into v_wallet_currency
  from public.wallets
  where id = p_wallet_id
  for update;

  if v_wallet_currency is null then
    raise exception 'wallet not found' using errcode = 'no_data_found';
  end if;
  if v_wallet_currency <> p_currency then
    raise exception 'currency mismatch: wallet holds %', v_wallet_currency using errcode = 'check_violation';
  end if;

  -- Idempotency: check if entry already exists BEFORE inserting.
  select wallet_id, kind, amount_minor, currency, reference
  into v_existing_wallet_id, v_existing_kind, v_existing_amount, v_existing_currency, v_existing_reference
  from public.wallet_entries
  where id = p_id;

  if v_existing_wallet_id is not null then
    if v_existing_wallet_id is distinct from p_wallet_id
       or v_existing_kind is distinct from p_kind
       or v_existing_amount is distinct from p_amount_minor
       or v_existing_currency is distinct from p_currency
       or v_existing_reference is distinct from coalesce(p_reference, '') then
      raise exception
        'idempotency conflict: entry % already exists with different parameters',
        p_id
        using errcode = 'check_violation';
    end if;
    -- Parameters match: idempotent replay, return successfully without inserting.
    return;
  end if;

  -- Calculate existing balance and reservations BEFORE inserting the new entry.
  -- This excludes the proposed entry from the calculation.
  if p_kind = 'debit' or p_kind = 'reserve' then
    select coalesce(sum(
      case
        when kind in ('credit', 'refund', 'compensation') then amount_minor
        when kind = 'debit' then -amount_minor
        else 0
      end
    ), 0) into v_balance
    from public.wallet_entries
    where wallet_id = p_wallet_id;

    select greatest(0, coalesce(sum(
      case
        when kind = 'reserve' then amount_minor
        when kind = 'release' then -amount_minor
        else 0
      end
    ), 0)) into v_reserved
    from public.wallet_entries
    where wallet_id = p_wallet_id;

    if p_amount_minor > (v_balance - v_reserved) then
      raise exception 'insufficient available balance' using errcode = 'check_violation';
    end if;
  end if;

  -- Insert the ledger row only after all applicable checks pass.
  insert into public.wallet_entries (id, wallet_id, kind, amount_minor, currency, reference)
  values (p_id, p_wallet_id, p_kind, p_amount_minor, p_currency, coalesce(p_reference, ''));
exception when unique_violation then
  -- Concurrent insert with same id. Verify the existing row matches.
  select wallet_id, kind, amount_minor, currency, reference
  into v_existing_wallet_id, v_existing_kind, v_existing_amount, v_existing_currency, v_existing_reference
  from public.wallet_entries
  where id = p_id;

  if v_existing_wallet_id is distinct from p_wallet_id
     or v_existing_kind is distinct from p_kind
     or v_existing_amount is distinct from p_amount_minor
     or v_existing_currency is distinct from p_currency
     or v_existing_reference is distinct from coalesce(p_reference, '') then
    raise exception
      'idempotency conflict: entry % already exists with different parameters',
      p_id
      using errcode = 'check_violation';
  end if;
  -- Parameters match: idempotent replay from concurrent request.
  return;
end;
$$;

-- Revoke from every role. No external caller can reach this function directly.
revoke all on function public.wallet_insert_entry(uuid, text, text, bigint, text, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Service-role mutations (credit / debit / refund / compensate). Server-side only.
-- ---------------------------------------------------------------------------

create or replace function public.wallet_credit(
  p_wallet_id uuid,
  p_id text,
  p_amount_minor bigint,
  p_currency text,
  p_reference text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform public.wallet_insert_entry(p_wallet_id, p_id, 'credit', p_amount_minor, p_currency, p_reference);
end;
$$;

create or replace function public.wallet_debit(
  p_wallet_id uuid,
  p_id text,
  p_amount_minor bigint,
  p_currency text,
  p_reference text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform public.wallet_insert_entry(p_wallet_id, p_id, 'debit', p_amount_minor, p_currency, p_reference);
end;
$$;

create or replace function public.wallet_refund(
  p_wallet_id uuid,
  p_id text,
  p_amount_minor bigint,
  p_currency text,
  p_reference text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- Refunds increase the balance; no available-balance check is required.
  perform public.wallet_insert_entry(p_wallet_id, p_id, 'refund', p_amount_minor, p_currency, p_reference);
end;
$$;

create or replace function public.wallet_compensate(
  p_wallet_id uuid,
  p_id text,
  p_amount_minor bigint,
  p_currency text,
  p_reference text,
  p_description text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comp_reference text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- Compensation credits the wallet using distinct kind 'compensation' and reference
  -- prefix 'comp:'. The description is stored in the reference field after the prefix
  -- for auditability (format: comp:<reference>:<description>).
  v_comp_reference := 'comp:' || p_reference;
  if p_description <> '' then
    v_comp_reference := v_comp_reference || ':' || p_description;
  end if;
  perform public.wallet_insert_entry(
    p_wallet_id,
    p_id,
    'compensation',
    p_amount_minor,
    p_currency,
    v_comp_reference
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner-callable holds (reserve / release). Authenticated users only.
-- ---------------------------------------------------------------------------

create or replace function public.wallet_reserve(
  p_id text,
  p_amount_minor bigint,
  p_currency text,
  p_reference text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;
  -- Lock the wallet row FIRST (consistent lock order: wallet before entry).
  select id into v_wallet_id
  from public.wallets
  where user_id = auth.uid()
  for update;

  if v_wallet_id is null then
    raise exception 'wallet not found' using errcode = 'no_data_found';
  end if;

  perform public.wallet_insert_entry(v_wallet_id, p_id, 'reserve', p_amount_minor, p_currency, p_reference);
end;
$$;

create or replace function public.wallet_release(p_reservation_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.wallet_entries;
  v_wallet_id uuid;
  v_existing_release public.wallet_entries;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  -- Lock the wallet row FIRST (consistent lock order: wallet before entry).
  select id into v_wallet_id
  from public.wallets
  where user_id = auth.uid()
  for update;

  -- Then lock the reservation entry.
  select * into v_reservation
  from public.wallet_entries
  where id = p_reservation_id
    and wallet_id = v_wallet_id
    and kind = 'reserve'
  for update;

  if v_reservation.id is null then
    raise exception 'reservation not found' using errcode = 'no_data_found';
  end if;

  -- Check for existing release entry with full field verification.
  select * into v_existing_release
  from public.wallet_entries
  where id = v_reservation.id || '-release'
    and wallet_id = v_reservation.wallet_id;

  if v_existing_release.id is not null then
    -- Verify all fields match before accepting idempotent replay.
    if v_existing_release.wallet_id is distinct from v_reservation.wallet_id
       or v_existing_release.kind is distinct from 'release'
       or v_existing_release.amount_minor is distinct from v_reservation.amount_minor
       or v_existing_release.currency is distinct from v_reservation.currency
       or v_existing_release.reference is distinct from v_reservation.reference then
      raise exception
        'idempotency conflict: release entry % already exists with different parameters',
        v_reservation.id || '-release'
        using errcode = 'check_violation';
    end if;
    return;
  end if;

  -- Full-release only: release amount equals the reservation amount, derived from
  -- the reservation row, never from caller input.
  perform public.wallet_insert_entry(
    v_reservation.wallet_id,
    v_reservation.id || '-release',
    'release',
    v_reservation.amount_minor,
    v_reservation.currency,
    v_reservation.reference
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------

-- Balance helpers: SECURITY INVOKER, RLS enforces ownership. Authenticated users
-- can only read their own wallet's balance. service_role can query directly.
revoke all on function public.wallet_balance_minor(uuid) from public, anon, authenticated;
revoke all on function public.wallet_reserved_minor(uuid) from public, anon, authenticated;
grant execute on function public.wallet_balance_minor(uuid) to authenticated;
grant execute on function public.wallet_reserved_minor(uuid) to authenticated;

-- Service-role mutations: only service_role can credit, debit, refund, compensate.
revoke all on function public.wallet_credit(uuid, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.wallet_debit(uuid, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.wallet_refund(uuid, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.wallet_compensate(uuid, text, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.wallet_credit(uuid, text, bigint, text, text) to service_role;
grant execute on function public.wallet_debit(uuid, text, bigint, text, text) to service_role;
grant execute on function public.wallet_refund(uuid, text, bigint, text, text) to service_role;
grant execute on function public.wallet_compensate(uuid, text, bigint, text, text, text) to service_role;

-- Owner-callable holds: authenticated users can reserve/release their own funds.
revoke all on function public.wallet_reserve(text, bigint, text, text) from public, anon;
revoke all on function public.wallet_release(text) from public, anon;
grant execute on function public.wallet_reserve(text, bigint, text, text) to authenticated;
grant execute on function public.wallet_release(text) to authenticated;