-- 0004_wallet.sql
-- Stage 7: wallet persistence (prepared, NOT applied automatically).
--
-- This migration turns the pure ledger in packages/shared/src/wallet/ledger.ts into
-- durable tables with row-level security. It mirrors the ledger's rules exactly:
--   * money is integer minor units of one ISO currency;
--   * balances are derived from an append-only list of entries, never a stored number;
--   * duplicate entry ids are refused (idempotency);
--   * a currency mismatch is refused (a wallet holds one currency);
--   * a debit that would overdraw is refused;
--   * a reservation holds funds without changing the balance.
--
-- Access model:
--   * a customer may READ their own wallet and entries;
--   * a customer may RESERVE and RELEASE their own funds (harmless holds);
--   * only the service role (the Worker, after a verified payment or an AI run)
--     may CREDIT, DEBIT or REFUND — a browser can never invent money.
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

revoke all on public.wallets from anon, authenticated;
grant select on public.wallets to authenticated;

-- ---------------------------------------------------------------------------
-- Ledger entries (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.wallet_entries (
  id text primary key,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  kind text not null check (kind in ('credit', 'debit', 'reserve', 'release', 'refund')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reference text not null default '',
  created_at timestamptz not null default now(),
  constraint wallet_entries_amount_safe check (amount_minor <= 9007199254740991)
);

comment on table public.wallet_entries is
  'Append-only ledger. One row per credit/debit/reserve/release/refund. The id is the idempotency key.';

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

revoke all on public.wallet_entries from anon, authenticated;
grant select on public.wallet_entries to authenticated;

-- Append-only guard. Corrections are new compensating rows, never updates or deletes.
drop trigger if exists wallet_entries_reject_mutation on public.wallet_entries;
create trigger wallet_entries_reject_mutation
  before update or delete on public.wallet_entries
  for each row execute function public.reject_mutation();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Current balance: credits + refunds - debits. Reserves/releases do not move it.
create or replace function public.wallet_balance_minor(p_wallet_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case
      when kind in ('credit', 'refund') then amount_minor
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
security definer
set search_path = ''
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

-- Shared insert with the ledger invariants. Raises rather than silently accepting.
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
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'amount must be a positive integer' using errcode = 'check_violation';
  end if;

  -- Idempotency: replaying the same entry id is a no-op, not an error.
  if exists (select 1 from public.wallet_entries where id = p_id) then
    return;
  end if;

  select currency into v_wallet_currency from public.wallets where id = p_wallet_id for update;
  if v_wallet_currency is null then
    raise exception 'wallet not found' using errcode = 'no_data_found';
  end if;
  if v_wallet_currency <> p_currency then
    raise exception 'currency mismatch: wallet holds %', v_wallet_currency using errcode = 'check_violation';
  end if;

  if p_kind = 'debit' then
    v_balance := public.wallet_balance_minor(p_wallet_id);
    if p_amount_minor > v_balance then
      raise exception 'insufficient balance' using errcode = 'check_violation';
    end if;
  elsif p_kind = 'reserve' then
    v_balance := public.wallet_balance_minor(p_wallet_id);
    v_reserved := public.wallet_reserved_minor(p_wallet_id);
    if p_amount_minor > (v_balance - v_reserved) then
      raise exception 'insufficient available balance' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.wallet_entries (id, wallet_id, kind, amount_minor, currency, reference)
  values (p_id, p_wallet_id, p_kind, p_amount_minor, p_currency, coalesce(p_reference, ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Service-role mutations (Worker only). Never callable by a browser.
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
  perform public.wallet_insert_entry(p_wallet_id, p_id, 'refund', p_amount_minor, p_currency, p_reference);
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner-callable holds (reserve / release). These move funds in and out of a hold
-- but never create money, so exposing them to the authenticated owner is safe.
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
  select id into v_wallet_id from public.wallets where user_id = auth.uid();
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
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;
  select id into v_wallet_id from public.wallets where user_id = auth.uid();

  select * into v_reservation from public.wallet_entries
  where id = p_reservation_id and wallet_id = v_wallet_id and kind = 'reserve';
  if v_reservation.id is null then
    raise exception 'reservation not found' using errcode = 'no_data_found';
  end if;

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
-- Grants: execute only to the roles that should call each function.
-- ---------------------------------------------------------------------------

revoke all on function public.wallet_credit(uuid, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.wallet_debit(uuid, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.wallet_refund(uuid, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.wallet_reserve(text, bigint, text, text) from public, anon;
revoke all on function public.wallet_release(text) from public, anon;

grant execute on function public.wallet_credit(uuid, text, bigint, text, text) to service_role;
grant execute on function public.wallet_debit(uuid, text, bigint, text, text) to service_role;
grant execute on function public.wallet_refund(uuid, text, bigint, text, text) to service_role;
grant execute on function public.wallet_reserve(text, bigint, text, text) to authenticated;
grant execute on function public.wallet_release(text) to authenticated;

-- Read helpers are safe for the owner.
revoke all on function public.wallet_balance_minor(uuid) from public, anon;
revoke all on function public.wallet_reserved_minor(uuid) from public, anon;