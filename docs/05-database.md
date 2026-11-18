# Database strategy

PostgreSQL on Supabase. Money is the most sensitive data in the product, so the
schema is designed before it is created and financial tables are only introduced in
Stage 7, once the ledger rules are implemented.

## Principles

1. All timestamps are `timestamptz`, written by the server, displayed in the user's
   zone.
2. Money is stored as **integer minor units** plus an ISO 4217 currency code. Never
   a float, never a formatted string.
3. Credits are integers. Balances are never edited directly; they change only
   through ledger rows written inside a transaction.
4. The ledger is append-only. Corrections are compensating rows, never updates.
5. Row Level Security is enabled on every user-facing table in the same migration
   that creates it.
6. Clients get no write access to financial or catalogue tables at all. The API
   writes with the service role.

## Planned schema

| Table | Stage | Purpose |
|---|---|---|
| `profiles` | 4 | 1:1 with `auth.users`; display name, country, locale, timezone |
| `platform_settings` | 4 | tunable values: free allowance, daily caps, feature flags |
| `tool_catalog` | 5 | server truth for tool availability and credit price |
| `tool_runs` | 5 | one row per tool execution (anonymous utility runs allowed) |
| `saved_results` | 6 | user-saved outputs, private by default |
| `wallets` | 7 | current credit balance per user, `balance >= 0` |
| `credit_transactions` | 7 | append-only ledger of every balance change |
| `credit_packages` | 7 | sellable bundles with price and currency |
| `free_allowance_grants` | 7 | anti-abuse records of trial grants |
| `payment_transactions` | 8 | purchase attempts and verified outcomes |
| `payment_events` | 8 | raw webhook log for idempotency and audit |
| `audit_log` | 7 | admin and money-affecting actions |

Relationships:

```
auth.users 1—1 profiles 1—1 wallets
wallets    1—N credit_transactions
auth.users 1—N tool_runs, saved_results, payment_transactions
tool_runs  N—1 tool_catalog (by slug)
credit_transactions N—1 payment_transactions (for purchases)
```

## Credit ledger model

Every row records: `user_id`, `delta`, `balance_after`, `type`
(`grant_free`, `purchase`, `ai_charge`, `refund_reversal`, `admin_adjust`),
`reference_id`, `idempotency_key`, `expires_at`, `created_at`.

Rules:

- `unique (user_id, idempotency_key)` makes duplicate submissions harmless.
- Spending is a single Postgres function that locks the wallet row, checks the
  balance, inserts the ledger row and updates the balance in one transaction.
- Spending order: soonest-expiring free credits first, then purchased credits.
- Purchased credits have `expires_at = NULL`. That is how "never expire" is enforced
  in the schema rather than trusted to application code.
- A technical failure writes a `refund_reversal` row referencing the original charge.
- A reconciliation query compares `sum(delta)` with `wallets.balance` and alerts on
  drift.

## Row Level Security plan

| Table | Client select | Client write |
|---|---|---|
| `profiles` | own row only | own limited columns (Stage 4 review) |
| `tool_runs` | own rows only | none (API writes) |
| `saved_results` | own rows only | own rows, validated |
| `wallets` | own row only | none |
| `credit_transactions` | own rows only | none |
| `payment_transactions` | own rows only | none |
| `tool_catalog`, `platform_settings` | read-only public subset | none |

Deny-by-default: `alter table ... enable row level security;` plus explicit policies.
No table is left without RLS, and no policy uses `using (true)` for user data.

## Migrations

- Forward-only, numbered, in `supabase/migrations/`.
- Applied in the Supabase SQL editor (phone-friendly) or by CLI/CI.
- No destructive change without a written note in the migration header.
- See `supabase/README.md` for the workflow.

## What exists today

- `0001_extensions.sql`: pgcrypto, citext, pg_trgm.
- `0002_conventions.sql`: `touch_updated_at`, `reject_mutation`.
- `0003_profiles.sql`: `public.profiles`.

### `public.profiles`

| Column | Type | Client writable |
|---|---|---|
| `id` | uuid, FK to `auth.users`, primary key | no |
| `email` | citext (mirrored for display) | no |
| `display_name` | text, max 60 | yes |
| `avatar_url` | text, https only | yes |
| `preferred_locale` | text, constrained to supported locales | yes |
| `created_at`, `updated_at` | timestamptz | no |

RLS is enabled. Policies allow `select` and `update` only where
`auth.uid() = id`; there is no client insert or delete path. Rows are created by the
`handle_new_user` trigger on `auth.users` and removed by cascade. `updated_at` is
maintained by `touch_updated_at`. Column grants restrict updates to the three editable
columns listed above.

No wallet, credit or payment tables exist yet, which is intentional: they arrive with
the stage that implements their rules.
