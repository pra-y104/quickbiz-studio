#!/usr/bin/env bash
# concurrency_test.sh
# Genuine multi-session PostgreSQL concurrency tests for QuickBiz Studio 0004/0005.
#
# A single psql session cannot exercise row-lock serialisation, so these tests run
# two concurrent psql sessions that race on the same wallet/payment row and then
# assert the final state. They complement pg_integration_test.sql.
#
# Prerequisites (isolated TEST database only — never production):
#   * Migrations 0001-0005 applied.
#   * psql available and TEST_DATABASE_URL exported, e.g.:
#       export TEST_DATABASE_URL='postgresql://.../quickbiz_test'
#
# Run:
#   bash supabase/tests/concurrency_test.sh
#
# The script cleans up its fixtures on exit.

set -euo pipefail

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL must be set to an isolated test database}"

PSQL=(psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -t -A)

cleanup() {
  "${PSQL[@]}" >/dev/null 2>&1 <<'SQL' || true
    set request.jwt.claims = '{"role":"service_role"}';
    delete from public.wallet_entries where reference like 'conc:%';
    delete from public.wallet_entries where id like 'conc:%';
    delete from public.payments where reference like 'conc:%';
    delete from public.wallets where user_id = '33333333-3333-3333-3333-333333333333';
    delete from auth.users where id = '33333333-3333-3333-3333-333333333333';
SQL
}
trap cleanup EXIT

fail() { echo "CONCURRENCY ASSERT FAILED: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Fixtures: one user, one wallet funded with 1000, one successful payment of 1000.
# ---------------------------------------------------------------------------
"${PSQL[@]}" <<'SQL'
set request.jwt.claims = '{"role":"service_role"}';
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('33333333-3333-3333-3333-333333333333','authenticated','authenticated','conc@test.local',now(),now(),now())
on conflict (id) do nothing;
insert into public.wallets (user_id, currency)
values ('33333333-3333-3333-3333-333333333333','USD')
on conflict (user_id) do nothing;
select public.wallet_credit(
  (select id from public.wallets where user_id='33333333-3333-3333-3333-333333333333'),
  'conc:seed', 1000, 'USD', 'seed');
insert into public.payments (reference, user_id, provider, amount_minor, currency, status)
values ('conc:P1','33333333-3333-3333-3333-333333333333','paystack',1000,'USD','success')
on conflict (reference) do nothing;
SQL

WALLET_ID="$("${PSQL[@]}" -c "select id from public.wallets where user_id='33333333-3333-3333-3333-333333333333';")"
[ -n "$WALLET_ID" ] || fail "could not resolve test wallet id"

# ---------------------------------------------------------------------------
# Test 1: concurrent debits cannot overdraft.
# Two sessions each debit 600 from a 1000 balance. Row locking must serialise
# them so exactly one succeeds; the final balance is 400 and there is one debit.
# ---------------------------------------------------------------------------
run_debit() {
  "${PSQL[@]}" <<SQL
set request.jwt.claims = '{"role":"service_role"}';
begin;
select pg_sleep(0.4);
select public.wallet_debit('$WALLET_ID','$1',600,'USD','conc:debit');
commit;
SQL
}

run_debit conc:debit:A & PID_A=$!
run_debit conc:debit:B & PID_B=$!
# One of the two is expected to fail with check_violation; ignore that here.
wait "$PID_A" 2>/dev/null || true
wait "$PID_B" 2>/dev/null || true

DEBITS="$("${PSQL[@]}" -c "select count(*) from public.wallet_entries where id in ('conc:debit:A','conc:debit:B');")"
BAL="$("${PSQL[@]}" -c "select public.wallet_balance_minor('$WALLET_ID');")"
[ "$DEBITS" = "1" ] || fail "expected exactly one successful debit, got $DEBITS"
[ "$BAL" = "400" ] || fail "expected final balance 400 after one 600 debit, got $BAL"
echo "ok - concurrent debits: one succeeded, balance=$BAL"

# Clean the debit entries before the next race.
"${PSQL[@]}" -c "delete from public.wallet_entries where id in ('conc:debit:A','conc:debit:B');" >/dev/null

# ---------------------------------------------------------------------------
# Test 2: concurrent external refund vs internal compensation.
# Both lock the payment row; exactly one benefit must result.
# ---------------------------------------------------------------------------
run_refund() {
  "${PSQL[@]}" <<'SQL'
set request.jwt.claims = '{"role":"service_role"}';
begin;
select pg_sleep(0.4);
select public.payment_refund('conc:P1','conc_refund',1000,now());
commit;
SQL
}
run_compensate() {
  "${PSQL[@]}" <<'SQL'
set request.jwt.claims = '{"role":"service_role"}';
begin;
select pg_sleep(0.4);
select public.payment_compensate('conc:P1','race');
commit;
SQL
}

run_refund & PID_R=$!
run_compensate & PID_C=$!
wait "$PID_R" 2>/dev/null || true
wait "$PID_C" 2>/dev/null || true

STATUS="$("${PSQL[@]}" -c "select status from public.payments where reference='conc:P1';")"
COMP_COUNT="$("${PSQL[@]}" -c "select count(*) from public.wallet_entries where id='comp:conc:P1';")"
REF_SET="$("${PSQL[@]}" -c "select refund_reference is not null from public.payments where reference='conc:P1';")"

# Exactly one of {refunded, compensated} may hold; never both.
if [ "$STATUS" = "refunded" ]; then
  [ "$COMP_COUNT" = "0" ] || fail "refunded payment must not have a compensation entry"
  [ "$REF_SET" = "t" ] || fail "refunded payment must store the refund reference"
  echo "ok - concurrent refund vs compensate: refund won, no compensation"
elif [ "$COMP_COUNT" = "1" ]; then
  [ "$STATUS" = "success" ] || fail "compensated payment must remain success, got $STATUS"
  [ "$REF_SET" = "f" ] || fail "compensated payment must not store a refund reference"
  echo "ok - concurrent refund vs compensate: compensation won, no refund"
else
  fail "expected exactly one benefit (refund or compensation); status=$STATUS comp=$COMP_COUNT"
fi

echo "ALL CONCURRENCY TESTS PASSED"