# Supabase (PostgreSQL) workspace

QuickBiz Studio uses Supabase for **PostgreSQL** and **Supabase Auth** only.
All privileged reads and writes (credits, payments, AI usage) go through the API
worker, which holds the service-role key server-side.

## What is here

- `migrations/` - forward-only SQL migrations, applied in filename order.
  - `0001_extensions.sql` - extensions used by later stages.
  - `0002_conventions.sql` - shared helper functions and append-only guards.

Table migrations land with the stage that needs them:

| Stage | Migrations |
|---|---|
| 4 | `profiles`, `platform_settings`, RLS policies for profile access |
| 5 | `tool_runs` (utility usage, anonymous allowed) |
| 6 | `tool_runs` AI columns, `saved_results` |
| 7 | `wallets`, `credit_transactions`, `credit_packages`, reconciliation views |
| 8 | `payment_transactions`, `payment_events` |

Financial tables are deliberately **not** created before Stage 7, so no insecure
money schema can exist in the meantime.

## Applying migrations

A phone-only workflow is supported. Two options:

1. **Supabase dashboard (no terminal):** open your project, go to the SQL Editor,
   paste the contents of the next unapplied migration file, run it, then record
   the filename in a `schema_migrations` note or in the project changelog.
2. **CI / CLI (recommended once available):** `supabase link --project-ref <ref>`
   then `supabase db push`. Requires the database password as a repository secret.

Rules:

- Migrations are **forward-only**. Fix mistakes with a new migration.
- Never edit an applied migration.
- Every new table must enable RLS in the same migration that creates it.
- Every foreign key to `auth.users` must use `on delete cascade` or `set null`
  deliberately, not by accident.

## Local development (optional)

`supabase start` needs Docker. A phone-only owner cannot run it, so local
development uses a hosted free project instead. This is a documented limitation,
not an oversight.

## Free tier limits to watch

- Project pauses after a period of inactivity on the free plan.
- Storage and compute quotas are small; the app stores text, not files, in Stage 2-7.
- Built-in email sending is rate-limited and not suitable for launch volume;
  a dedicated transactional email provider is a Stage 9 decision.
