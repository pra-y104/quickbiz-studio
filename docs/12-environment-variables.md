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
| `SUPABASE_SERVICE_ROLE_KEY` | ledger only | **secret** | bypasses RLS; required once migrations 0004/0005 are wired |
| `AI_ENABLED` | for AI | no | must be exactly `true` (with a key) before any adapter runs; default fail closed |
| `AI_PROVIDER` | no | no | preferred provider id; naming it does not enable AI |
| `AI_MODEL` | no | no | preferred model id for that provider |
| `AI_API_KEY` | no | **secret** | fallback Gemini key, server only |
| `GEMINI_API_KEY` | no | **secret** | Google AI Studio key for the Gemini adapter |
| `AI_OPENAI_BASE_URL` | no | no | Chat-Completions base URL; required to register that adapter |
| `AI_OPENAI_API_KEY` | no | **secret** | key for the OpenAI-compatible provider |
| `AI_OPENAI_MODEL` | no | no | model id for that provider (default `gpt-4o-mini`) |
| `AI_OPENAI_PROVIDER_ID` | no | no | registry id for that provider (default `openai`) |
| `AI_OPENAI_LABEL` | no | no | display label for that provider |
| `AI_REQUIRE_VERIFIED_EMAIL` | no | no | defaults to `true` (fail closed) |
| `PAYSTACK_SECRET_KEY` | Stage 8 | **secret** | only `sk_test_` honoured; used for API calls and webhook signature |
| `PAYSTACK_BASE_URL` | no | no | Paystack API base override (tests only) |
| `RATE_LIMIT_KV` | no | no | KV namespace **binding** for distributed rate limiting (not a secret) |
| `AI_QUOTA_KV` | no | no | KV namespace **binding** for the shared AI quota store (not a secret) |

`PAYSTACK_SECRET_KEY` is also the HMAC secret used to verify webhook signatures;
there is no separate webhook secret. `RATE_LIMIT_KV` and `AI_QUOTA_KV` are Cloudflare
bindings declared in `wrangler.toml` under `[[kv_namespaces]]`, not secrets. When they
are absent, the rate limiter and AI quota fall back to per-isolate memory.

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
