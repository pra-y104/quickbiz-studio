# PostgreSQL integration tests

These are **genuine** PostgreSQL tests. They execute the real SQL functions,
constraints, triggers and row-level security defined in
`supabase/migrations/0004_wallet.sql` and `0005_payments.sql` against a live
PostgreSQL / isolated Supabase project.

They are **not** the TypeScript simulations in
`apps/api/src/__tests__/migration-functions.test.ts`. Those simulations document
the intended behaviour and run in CI without a database; they do not prove RLS,
locking, or constraint behaviour. Only the tests in this directory do.

## Status in this build

The sandbox used to build this project has **no PostgreSQL engine, no Docker and
no live database credentials**, so these tests could not be executed here. They
are provided ready-to-run. Run them against a disposable test database before
applying the migrations to production.

## Prerequisites

1. A disposable PostgreSQL 15+ instance or an isolated Supabase test project.
2. Migrations applied in dependency order: `0001` → `0002` → `0003` → `0004` →
   `0005`. `0003` provides `auth.users`-backed profiles and the
   `anon` / `authenticated` / `service_role` roles.
3. `psql` on your PATH.
4. A connection string for the test database:

   ```sh
   export TEST_DATABASE_URL='postgresql://user:pass@localhost:5432/quickbiz_test'
   ```

## Run

```sh
# Functional tests (balance, settlement, events, refund, compensation,
# double-benefit guard, permissions, RLS, profile preservation).
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pg_integration_test.sql

# Concurrency tests (parallel debits; parallel refund vs compensation).
bash supabase/tests/concurrency_test.sh
```

Both scripts roll back / clean up after themselves. A run that prints
`ALL POSTGRESQL INTEGRATION TESTS PASSED` / `ALL CONCURRENCY TESTS PASSED` and
exits 0 is a pass; any `ASSERT FAILED` is a failure that must be fixed before
release.

## Coverage map

| Requirement | File | Section |
|---|---|---|
| Concurrent wallet credits/debits | `concurrency_test.sh` | Test 1 |
| Available-balance enforcement | `pg_integration_test.sql` | A |
| Duplicate settlement | `pg_integration_test.sql` | B |
| Conflicting settlement | `pg_integration_test.sql` | C |
| Provider-event idempotency/conflict | `pg_integration_test.sql` | D |
| External refund without wallet credit | `pg_integration_test.sql` | E |
| Internal compensation | `pg_integration_test.sql` | F |
| Concurrent refund vs compensation | `concurrency_test.sh` | Test 2 |
| Double-benefit guard | `pg_integration_test.sql` | G |
| Permissions (service-role only) | `pg_integration_test.sql` | H |
| RLS isolation between users | `pg_integration_test.sql` | I |
| Profiles preserved (0003 not weakened) | `pg_integration_test.sql` | J |

## Safety

Never point `TEST_DATABASE_URL` at production. The scripts insert test users,
wallets, payments and ledger entries (all namespaced `conc:` / `P1`..`P5`) and
delete them on exit. Run them only on a disposable database or a project you can
restore from backup.