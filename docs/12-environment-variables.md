# Environment variables

Copy `apps/web/.env.example` to `apps/web/.env.local` for the frontend (Vite loads
variables from its own directory), and `apps/api/.dev.vars.example` to
`apps/api/.dev.vars` for local worker secrets. The root `.env.example` is the combined
reference. All real files are gitignored.

## Frontend (public by definition)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | yes | API base URL, e.g. `http://localhost:8787` |
| `VITE_APP_VERSION` | no | shown in diagnostics and the build badge |
| `VITE_SUPABASE_URL` | for auth | public Supabase project URL; empty disables auth |
| `VITE_SUPABASE_ANON_KEY` | for auth | public anon key only - never the service role key |

Anything prefixed `VITE_` is compiled into the JavaScript bundle. Treat it as public.

## API worker

| Variable | Required | Public | Purpose |
|---|---|---|---|
| `ENVIRONMENT` | yes | no | `development`, `preview` or `production` |
| `APP_VERSION` | no | no | semver string returned by `/health` |
| `ALLOWED_ORIGINS` | yes in production | no | comma-separated CORS allowlist |
| `RATE_LIMIT_ENABLED` | no | no | `true`/`false` |
| `RATE_LIMIT_WINDOW_SECONDS` | no | no | window length, default 60 |
| `RATE_LIMIT_MAX_REQUESTS` | no | no | requests per window per client/path |
| `SUPABASE_URL` | for auth | no | project URL; derives the JWKS endpoint and issuer |
| `SUPABASE_JWKS_URL` | no | no | explicit JWKS override for non-standard deployments |
| `SUPABASE_JWT_SECRET` | legacy | **secret** | HS256 verification for older projects |
| `SUPABASE_SERVICE_ROLE_KEY` | not used yet | **secret** | bypasses RLS; server only |
| `AI_PROVIDER` | Stage 6 | no | preferred provider id; naming it does not enable AI |
| `AI_MODEL` | Stage 6 | no | preferred model id for that provider |
| `AI_API_KEY` | Stage 6 | **secret** | provider key, server only |
| `PAYSTACK_SECRET_KEY` | Stage 8 | **secret** | payment verification |
| `PAYSTACK_WEBHOOK_SECRET` | Stage 8 | **secret** | webhook signature check |

## Authentication pair

Authentication turns on only when the browser has **both** `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. With either missing, the gateway reports `unconfigured`,
forms stay disabled and the pages link to the in-app setup guide. On the worker, token
verification needs `SUPABASE_URL` (JWKS) or `SUPABASE_JWT_SECRET`; otherwise protected
routes return 503 rather than accepting a token unverified.

## Where values live

- Local: `apps/web/.env.local` and `apps/api/.dev.vars`.
- Production: Cloudflare dashboard (Pages variables and Worker secrets).
- CI: GitHub Actions secrets, only if a workflow needs them.
- Never: the repository, commit history, screenshots, or chat messages.
