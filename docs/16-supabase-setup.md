# Supabase setup

Stage 4 authentication is real, but inert until a Supabase project is connected. This
guide is the complete manual work. Nothing here is automated, and no paid resource is
required while usage stays inside the Supabase free tier.

## 1. Create a project

1. Sign in at <https://supabase.com> and create a project.
2. Choose a region close to the main audience.
3. Save the database password in a password manager. It is not needed by this stage
   unless you run migrations with `psql`.
4. From **Project settings → API**, note:
   - **Project URL** (`https://<project-ref>.supabase.co`)
   - **anon public** key
   - **service_role** key (server-only; do not put it in the web app)

## 2. Apply the migrations

Apply in order, from `supabase/migrations/`:

| Order | File | Purpose |
|---|---|---|
| 1 | `0001_extensions.sql` | required extensions and schemas |
| 2 | `0002_conventions.sql` | helper functions such as `touch_updated_at()` |
| 3 | `0003_profiles.sql` | profiles table, RLS, grants, signup trigger, backfill |

This repository has no `supabase/config.toml`, so the SQL editor is the supported
path today. Paste each file into the editor in order and check for errors after each
one. If you initialise the CLI workflow later, `supabase db push` applies the same
files in order.

`0003_profiles.sql` must run after `0002` because the profile trigger calls
`public.touch_updated_at()`.

## 3. Verify the database objects

Run in the SQL editor:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class where relname = 'profiles';

select policyname, cmd from pg_policies where tablename = 'profiles';

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'profiles';
```

Expected: RLS enabled and forced, two policies (`select`, `update`), and update grants
limited to `display_name`, `avatar_url`, `preferred_locale`.

## 4. Configure authentication URLs

In **Authentication → URL configuration**:

- **Site URL**: the deployed origin, for example `https://quickbiz.example`.
- **Redirect URLs** (add both local and production):
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/auth/reset-password`
  - `https://<production-origin>/auth/callback`
  - `https://<production-origin>/auth/reset-password`

Keep **Confirm email** enabled. The verification flow is part of this stage and should
be exercised, not bypassed.

Review the email templates. Recovery and confirmation messages must contain the
Supabase link placeholder; if the templates are rewritten, keep the token URL intact.

## 5. Environment variables

Frontend (browser, public):

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Worker (server):

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
# Optional, only for older projects that sign HS256 tokens:
SUPABASE_JWT_SECRET=<legacy JWT secret>
```

Local files:

- `apps/web/.env.local` (gitignored) — Vite reads variables from this directory.
- `apps/api/.dev.vars` (gitignored) — copied from `.dev.vars.example`.
- `.env` at the repository root is the documented reference, but Vite only loads the
  file inside `apps/web`.

Production: set `VITE_*` as Pages build variables and `SUPABASE_URL` as a Worker
variable or secret.

## 6. Smoke test

1. Start the web app and open `/register`.
2. Register with an address you can receive mail on.
3. Confirm the email from the inbox on the same browser.
4. Land on `/dashboard`, then open `/profile` and change the display name.
5. Sign out, sign in again, then request a password reset and complete it.
6. Try opening `/dashboard` while signed out: you should be redirected to
   `/login?next=%2Fdashboard`.

## 7. Checks worth running before launch

- Supabase **Auth → Rate limits** are appropriate for expected traffic.
- Email confirmation and recovery templates do not leak internal URLs.
- The anon key is the only Supabase key present in the built bundle:
  `grep -r "service_role" apps/web/dist` should return nothing.
- RLS is still enabled after any migration.
- Redirect URLs list every deployed origin and nothing wildcarded.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Forms disabled with a configuration notice | `VITE_SUPABASE_*` missing; restart the dev server after editing `.env.local` |
| "Email not confirmed" on sign-in | Confirmation link not opened, or it expired; resend from the sign-in screen |
| Reset link lands on "cannot be used" | Redirect URL not allow-listed, or the link was already used |
| API returns 503 | Worker has no `SUPABASE_URL` (or legacy secret) configured |
| Profile save fails | Migration not applied, RLS/grant mismatch, or the row was never created |
