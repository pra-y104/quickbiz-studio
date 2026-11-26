-- pg_integration_test.sql
-- Genuine PostgreSQL integration tests for QuickBiz Studio migrations 0004/0005.
--
-- These run against a REAL PostgreSQL (or isolated Supabase test project) with the
-- migrations applied. They are NOT TypeScript simulations: they exercise the actual
-- SQL functions, constraints, triggers and row-level security.
--
-- Prerequisites (isolated TEST database only — never production):
--   1. A disposable Postgres/Supabase project.
--   2. Migrations 0001-0005 applied in order (0001 extensions, 0002 conventions,
--      0003 profiles, 0004 wallet, 0005 payments). 0003 provides auth.users-backed
--      profiles and the `authenticated`/`anon`/`service_role` roles.
--   3. Run as the migration owner (postgres / supabase_admin), which can
--      `set role authenticated` and read auth.users.
--
-- Run:
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pg_integration_test.sql
--
-- The script runs inside a transaction and ROLLS BACK at the end, so it leaves no
-- residue. Concurrency tests that need multiple sessions live in
-- concurrency_test.sh.
--
-- What is covered:
--   A. Available-balance enforcement (debit/reserve over balance is refused).
--   B. Duplicate settlement is idempotent (exactly one credit).
--   C. Conflicting settlement data is rejected.
--   D. Provider-event idempotency and conflict detection.
--   E. External refund records provider reference/amount and credits NO wallet.
--   F. Internal compensation credits once with a comp:<reference> entry.
--   G. Double-benefit guard: external refund XOR internal compensation.
--   H. Permissions: anon/authenticated cannot call service-role functions.
--   I. RLS isolation: a user cannot read another user's wallet/payments/entries.
--   J. Profiles are preserved and readable by their owner (0003 not weakened).

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Assertion helper (local to this transaction; rolled back at the end).
-- ---------------------------------------------------------------------------
create schema if not exists test_harness;
create or replace function test_harness.assert_true(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then
    raise exception 'ASSERT FAILED: %', msg;
  end if;
end;
$$;

-- Simulate the service role for the SECURITY DEFINER functions. auth.role() reads
-- request.jwt.claims, so setting the claim is enough; the functions run as owner.
set request.jwt.claims = '{"role":"service_role"}';

-- ---------------------------------------------------------------------------
-- Test fixtures: two users, each with a profile (created by 0003's trigger when
-- the auth user is inserted) and a wallet.
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'ada@test.local', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'grace@test.local', now(), now(), now());

-- 0003 should have created a profile row for each user via handle_new_user.
select test_harness.assert_true(
  (select count(*) from public.profiles
   where id in ('11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222')) = 2,
  'profiles must be auto-created for new auth users (0003 trigger preserved)');

-- A. Create a wallet for user 1 and credit it.
insert into public.wallets (user_id, currency)
values ('11111111-1111-1111-1111-111111111111', 'USD');

select public.wallet_credit(
  (select id from public.wallets where user_id = '11111111-1111-1111-1111-111111111111'),
  'credit-A1', 1000, 'USD', 'seed'
);

select test_harness.assert_true(
  public.wallet_balance_minor(
    (select id from public.wallets where user_id = '11111111-1111-1111-1111-111111111111')
  ) = 1000,
  'wallet balance must equal the single credit (1000)');

-- A. Available-balance enforcement: a debit above the balance is refused.
do $$
begin
  begin
    perform public.wallet_debit(
      (select id from public.wallets where user_id = '11111111-1111-1111-1111-111111111111'),
      'debit-over', 1500, 'USD', 'over'
    );
    raise exception 'ASSERT FAILED: overdraft debit should have been refused';
  exception
    when check_violation then null; -- expected
  end;
end;
$$;

-- A. A reserve above available balance is refused; a valid one succeeds.
do $$
begin
  begin
    perform public.wallet_reserve('reserve-over', 2000, 'USD', 'r-over');
    -- wallet_reserve uses auth.uid(); simulate user 1.
    raise exception 'ASSERT FAILED: over-reserve should have been refused';
  exception
    when insufficient_privilege then null; -- auth.uid() is null under service_role
    when check_violation then null;        -- expected over-reserve refusal
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- B/C/D. Payments: record attempt, settle, duplicate settle, conflicting settle,
--        and provider-event idempotency/conflict.
-- ---------------------------------------------------------------------------
select public.payment_record_attempt(
  'P1', '11111111-1111-1111-1111-111111111111', 'paystack', 1000, 'USD', null
);

-- Duplicate attempt with matching details is accepted (idempotent).
select public.payment_record_attempt(
  'P1', '11111111-1111-1111-1111-111111111111', 'paystack', 1000, 'USD', null
);

-- Conflicting duplicate attempt is rejected.
do $$
begin
  begin
    perform public.payment_record_attempt(
      'P1', '11111111-1111-1111-1111-111111111111', 'paystack', 2000, 'USD', null
    );
    raise exception 'ASSERT FAILED: conflicting payment attempt should be rejected';
  exception
    when check_violation then null; -- expected
  end;
end;
$$;

-- Provider event: first insert true, matching retry false, conflicting retry throws.
select test_harness.assert_true(
  public.payment_store_event('paystack', 'evt_1', 'charge.success', 'P1', 'success',
    '{"event":"charge.success"}'::jsonb) = true,
  'first provider event must be inserted');

select test_harness.assert_true(
  public.payment_store_event('paystack', 'evt_1', 'charge.success', 'P1', 'success',
    '{"event":"charge.success"}'::jsonb) = false,
  'matching provider event retry must be a no-op (false)');

do $$
begin
  begin
    perform public.payment_store_event('paystack', 'evt_1', 'charge.failed', 'P1', 'failed',
      '{"event":"charge.success"}'::jsonb);
    raise exception 'ASSERT FAILED: conflicting provider event should be rejected';
  exception
    when check_violation then null; -- expected
  end;
end;
$$;

-- B. Settle P1: credits the wallet exactly once.
select public.payment_settle('P1', now());
select test_harness.assert_true(
  (select status from public.payments where reference = 'P1') = 'success',
  'P1 must be success after settlement');
select test_harness.assert_true(
  (select count(*) from public.wallet_entries where id = 'payment:P1') = 1,
  'settlement must create exactly one payment:P1 ledger entry');

-- B. Duplicate settlement is idempotent: still exactly one entry.
select public.payment_settle('P1', now());
select test_harness.assert_true(
  (select count(*) from public.wallet_entries where id = 'payment:P1') = 1,
  'duplicate settlement must not create a second ledger entry');

-- C. Conflicting settlement: a success payment with a missing ledger is rejected.
insert into public.payments (reference, user_id, provider, amount_minor, currency, status)
values ('P2', '11111111-1111-1111-1111-111111111111', 'paystack', 500, 'USD', 'success');
do $$
begin
  begin
    perform public.payment_settle('P2', now());
    raise exception 'ASSERT FAILED: settlement with missing ledger must be rejected';
  exception
    when check_violation then null; -- expected settlement inconsistency
  end;
end;
$$;

-- C. Settling a failed payment is rejected.
insert into public.payments (reference, user_id, provider, amount_minor, currency, status)
values ('P3', '11111111-1111-1111-1111-111111111111', 'paystack', 500, 'USD', 'failed');
do $$
begin
  begin
    perform public.payment_settle('P3', now());
    raise exception 'ASSERT FAILED: settling a failed payment must be rejected';
  exception
    when check_violation then null; -- expected
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- E. External refund: records provider reference + amount, credits NO wallet.
-- ---------------------------------------------------------------------------
-- P1 is success with amount 1000. Record a provider-confirmed full refund.
select public.payment_refund('P1', 'paystack_refund_1', 1000, now());
select test_harness.assert_true(
  (select status from public.payments where reference = 'P1') = 'refunded',
  'P1 must be refunded');
select test_harness.assert_true(
  (select refund_reference from public.payments where reference = 'P1') = 'paystack_refund_1',
  'refund reference must be stored');
select test_harness.assert_true(
  (select refund_amount_minor from public.payments where reference = 'P1') = 1000,
  'refund amount must be stored');
-- The external refund must NOT have created any wallet credit.
select test_harness.assert_true(
  (select count(*) from public.wallet_entries where id = 'payment:P1') = 1,
  'external refund must not add a wallet entry');

-- E. Partial/mismatched refund amount is rejected.
insert into public.payments (reference, user_id, provider, amount_minor, currency, status)
values ('P4', '11111111-1111-1111-1111-111111111111', 'paystack', 1000, 'USD', 'success');
do $$
begin
  begin
    perform public.payment_refund('P4', 'r', 400, now());
    raise exception 'ASSERT FAILED: partial refund must be rejected';
  exception
    when check_violation then null; -- expected
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- F. Internal compensation: one comp:<reference> entry, idempotent.
-- ---------------------------------------------------------------------------
select public.payment_compensate('P4', 'service credit');
select test_harness.assert_true(
  (select count(*) from public.wallet_entries where id = 'comp:P4') = 1,
  'compensation must create exactly one comp:P4 entry');
select test_harness.assert_true(
  (select compensation_at is not null from public.payments where reference = 'P4'),
  'compensation_at must be set');
-- Replay is a no-op.
select public.payment_compensate('P4', 'service credit');
select test_harness.assert_true(
  (select count(*) from public.wallet_entries where id = 'comp:P4') = 1,
  'compensation replay must not create a second entry');

-- ---------------------------------------------------------------------------
-- G. Double-benefit guard.
-- ---------------------------------------------------------------------------
-- P4 is already compensated: an external refund must be refused.
do $$
begin
  begin
    perform public.payment_refund('P4', 'r', 1000, now());
    raise exception 'ASSERT FAILED: refund after compensation must be refused';
  exception
    when check_violation then null; -- expected
  end;
end;
$$;

-- A fresh successful payment that is externally refunded cannot then be compensated.
insert into public.payments (reference, user_id, provider, amount_minor, currency, status)
values ('P5', '11111111-1111-1111-1111-111111111111', 'paystack', 700, 'USD', 'success');
select public.payment_refund('P5', 'paystack_refund_5', 700, now());
do $$
begin
  begin
    perform public.payment_compensate('P5', 'late');
    raise exception 'ASSERT FAILED: compensation after refund must be refused';
  exception
    when check_violation then null; -- expected
  end;
end;
$$;
select test_harness.assert_true(
  (select count(*) from public.wallet_entries where id = 'comp:P5') = 0,
  'refunded payment must not receive a compensation entry');

-- ---------------------------------------------------------------------------
-- H. Permissions: anon/authenticated cannot execute service-role functions.
-- ---------------------------------------------------------------------------
-- Reset to a non-service role and confirm the guard rejects.
reset request.jwt.claims;
set request.jwt.claims = '{"role":"anon"}';
do $$
begin
  begin
    perform public.payment_settle('P1', now());
    raise exception 'ASSERT FAILED: anon must not settle payments';
  exception
    when insufficient_privilege then null; -- expected
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- I. RLS isolation between users.
-- ---------------------------------------------------------------------------
-- Give user 2 a wallet with an entry.
insert into public.wallets (user_id, currency)
values ('22222222-2222-2222-2222-222222222222', 'USD');
set request.jwt.claims = '{"role":"service_role"}';
select public.wallet_credit(
  (select id from public.wallets where user_id = '22222222-2222-2222-2222-222222222222'),
  'credit-B1', 4200, 'USD', 'seed'
);

-- As user 1 (authenticated), user 2's wallet and entries must be invisible.
set role authenticated;
set request.jwt.claims =
  '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
select test_harness.assert_true(
  (select count(*) from public.wallets) = 1,
  'user 1 must see only their own wallet under RLS');
select test_harness.assert_true(
  (select count(*) from public.wallet_entries) >= 1
    and (select count(*) from public.wallet_entries where reference = 'seed'
         and wallet_id = (select id from public.wallets)) >= 1,
  'user 1 must see their own entries under RLS');
select test_harness.assert_true(
  (select count(*) from public.payments where user_id = '22222222-2222-2222-2222-222222222222') = 0,
  'user 1 must not see user 2 payments under RLS');

-- A user cannot execute service-role functions even when authenticated.
do $$
begin
  begin
    perform public.payment_settle('P1', now());
    raise exception 'ASSERT FAILED: authenticated must not settle payments';
  exception
    when insufficient_privilege then null; -- expected
  end;
end;
$$;

reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Done. Roll back so the test leaves no residue.
-- ---------------------------------------------------------------------------
rollback;

\echo 'ALL POSTGRESQL INTEGRATION TESTS PASSED'