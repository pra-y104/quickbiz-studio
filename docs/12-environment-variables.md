# Environment variables

Copy `.env.example` to `.env` for local frontend work, and
`apps/api/.dev.vars.example` to `apps/api/.dev.vars` for local worker secrets.
Both real files are gitignored.

## Frontend (public by definition)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | yes | API base URL, e.g. `http://localhost:8787` |
| `VITE_APP_VERSION` | no | shown in diagnostics and the build badge |
| `VITE_SUPABASE_URL` | Stage 4 | public Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Stage 4 | public anon key only - never the service role key |

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
| `SUPABASE_URL` | Stage 4 | no | project URL for server-side calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Stage 4 | **secret** | bypasses RLS; server only |
| `AI_PROVIDER` | Stage 6 | no | active provider id |
| `AI_API_KEY` | Stage 6 | **secret** | provider key, server only |
| `PAYSTACK_SECRET_KEY` | Stage 8 | **secret** | payment verification |
| `PAYSTACK_WEBHOOK_SECRET` | Stage 8 | **secret** | webhook signature check |

## Where values live

- Local: `.env` and `apps/api/.dev.vars`.
- Production: Cloudflare dashboard (Pages variables and Worker secrets).
- CI: GitHub Actions secrets, only if a workflow needs them.
- Never: the repository, commit history, screenshots, or chat messages.
