# Stage 10: deployment readiness and handover

This document is the handover pack. It describes how to deploy QuickBiz Studio with
the current architecture, what is verified, and what is **not** ready.

Nothing in this document has been deployed. No production service is active.

## 1. Architecture

| Layer | Service | Notes |
|---|---|---|
| Web app | Cloudflare Pages | Static build of `apps/web` (`pnpm build:web`) |
| API | Cloudflare Workers | `apps/api`, built with `wrangler deploy --dry-run` |
| Auth + database | Supabase | Postgres with RLS; migrations in `supabase/migrations` |
| Source | GitHub | `pra-y104/quickbiz-studio` |

Render is **not** used and is not required.

## 6. Environment variables

### Web (`apps/web`) — build time, all public

| Name | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | yes | Base URL of the Worker, e.g. `https://quickbiz-studio-api.<subdomain>.workers.dev` |
| `VITE_SUPABASE_URL` | optional | Supabase project URL; empty disables sign-in with a visible notice |
| `VITE_SUPABASE_ANON_KEY` | optional | **Publishable** anon key only — never the service-role key |
| `VITE_APP_VERSION` | optional | Semver shown in diagnostics |

Set these in the Pages project settings (Build variables) or in `apps/web/.env.local`
for local builds. Only `VITE_*` names reach the browser.

### Worker (`apps/api`) — server secrets

| Name | Required | Purpose |
|---|---|---|
| `ENVIRONMENT` | yes | `production` for the live Worker |
| `ALLOWED_ORIGINS` | yes | Comma-separated frontend origins |
| `SUPABASE_URL` | for auth | Project URL |
| `SUPABASE_JWKS_URL` | optional | Explicit JWKS override |
| `SUPABASE_JWT_SECRET` | legacy | HS256 fallback; prefer JWKS |
| `AI_PROVIDER` / `AI_MODEL` | no | Preference only; no adapter is registered |
| `AI_API_KEY` | no | Reserved; unused in this build |
| `RATE_LIMIT_*` | no | Tunables for the per-isolate limiter |

Set secrets with `wrangler secret put <NAME>` — **never** in `wrangler.toml`, the
repository, or a chat message.

## 6. Deployment steps (dashboard, no CLI required)

1. **Database**: create a Supabase project (free tier), then apply
   `supabase/migrations/0001_extensions.sql`, `0002_conventions.sql`,
   `0003_profiles.sql` in order using the SQL editor. *Requires owner approval.*
4. **Web**: Cloudflare dashboard → Workers & Pages → Create → Pages → connect the
   GitHub repository → build command `pnpm install && pnpm build:web`, output
   directory `apps/web/dist` → add the `VITE_*` variables → deploy.
5. **API**: create a Worker named `quickbiz-studio-api`; in `apps/api` run
   `npx wrangler login`, then `npx wrangler deploy`. Add the secrets listed above.
6. **Connect**: set `VITE_API_BASE_URL` to the Worker URL and redeploy the Pages
   project; set `ALLOWED_ORIGINS` on the Worker to the Pages domain.
7. **Verify**: `GET /health` returns 200; `GET /api/v1/ai/status` returns
   `configured: false`; sign-in works if Supabase variables are set.

### Rollback

Cloudflare keeps previous deployments: Pages → project → **Deployments** → “Rollback
to this deployment”. For the Worker, `wrangler rollback` redeploys the previous
version, or promote the previous deployment in the dashboard. Database changes are
forward-only; restore from a Supabase backup if needed.

## 7. Monitoring and operations

- Workers Logs (Observability) is enabled in `wrangler.toml`; structured JSON lines
  include `requestId`, `event` and safe fields only.
- Health endpoint: `GET /health`.
- Alerts to configure in Cloudflare: 5xx rate, Worker exceptions, request spikes.
- No customer data or secrets are logged; the logger redacts
  `authorization`, `cookie`, `token`, `secret`, `api_key`.

## 8. Beginner checklist (Android phone)

1. Open the Cloudflare dashboard in Chrome, sign in.
2. Go to **Workers & Pages → Create → Pages → Connect to Git**, choose
   `pra-y104/quickbiz-studio`, branch `main`.
7. Build command: `pnpm install && pnpm build:web`; output `apps/web/dist`.
8. Add variables `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
9. Deploy, then open the printed `.pages.dev` URL on the phone.
10. For the API: **Workers → Create Worker**, then in a terminal
    `cd apps/api && npx wrangler login && npx wrangler deploy`.
11. Set Worker secrets with `npx wrangler secret put SUPABASE_URL` (repeat per name).
12. Update `ALLOWED_ORIGINS` to your Pages domain and redeploy.

Everything above is free-tier; a custom domain and paid AI usage are the only
expected future costs.

## 9. Readiness status (honest)

| Area | Status |
|---|---|
| Web build, API build | Passing |
| Tests | Passing (unit/integration, no browser) |
| Authentication | Implemented; **not verified against a live Supabase project** |
| Database migrations | Written for profiles only; **not applied** |
| AI execution | Fail-closed 503; no provider activated |
| Wallet | Domain ledger implemented and tested; **no tables, no UI** |
| Payments | Simulated provider and signature verification; **no live gateway** |
| Legal pages | Scaffolding with placeholders; **needs owner details** |
| CSP | Written and unit-tested; **not deploy-verified** |
| Rate limiting | Per isolate — **high-severity gap** |

**Not ready for production.** Mandatory blockers: shared rate limiting, a
deploy-verified CSP, applied and reviewed migrations, owner legal details, and a
manual Android/desktop QA pass.
## 10. Supabase environment note

The Kilo Environment settings are not injected into the sandbox process environment,
so neither the Vite dev server nor `wrangler` can read `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` or `SUPABASE_URL` from here. To use them:

- **Local web build**: create `apps/web/.env.local` (git-ignored) containing the two
  `VITE_*` names, then run `pnpm --filter @quickbiz/web dev`.
- **Worker**: `npx wrangler secret put SUPABASE_URL` (and the JWKS/secret names if
  used) inside `apps/api`.
- **Pages/Worker runtime**: set the same names in the Cloudflare project settings.

No credential file was created, and no value was printed or committed.
