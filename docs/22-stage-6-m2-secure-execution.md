# Stage 6 M2: secure AI execution (current state)

`POST /api/v1/ai/run` is now a real, authenticated, fail-closed endpoint
(`apps/api/src/routes/ai.ts`). It does **not** execute any provider in this build,
because no adapter is registered.

## Order of operations

1. **Authenticate.** `requireAuth` verifies the Supabase access token. An anonymous
   caller receives `401` and learns nothing about the AI surface.
2. **Validate the envelope.** The body must be `{ tool, input }` with no extra keys,
   and the tool slug must be one of the eight contracts.
3. **Validate the tool input** against the shared Zod schema, before any work.
   Failures return `422` with field paths only — never submitted values.
8. **Check availability from the registry**, never from configuration. With no
   adapter registered the endpoint returns `503`. Setting `AI_PROVIDER` changes
   nothing.
5. **Execute** via `executeAiTool` with the caller's abort signal, but only when an
   adapter is registered *and* configured.
6. **Map failures** with `describeAiFailure`: validation → 422, unavailable → 503,
   provider → 502 (429 when rate-limited), unknown → generic 500 with no detail.

## What M2 still owes before any provider may be registered

| Item | Status |
|---|---|
| Per-user quota and usage persistence | Not implemented — needs a migration (Stage 7) |
| Distributed rate limiting | Blocked — the current limiter is per isolate |
| Verified-email requirement for AI runs | Not enforced — decision D4 |
| Idempotency for retried runs | Not implemented |
| Structured redacted logging with correlation ids | Partial (request id exists) |

## Why the endpoint is safe while it is inert

- No adapter is registered (`PRODUCTION_ADAPTERS` is empty and module-local).
- No key is configured, so `isConfigured()` is false everywhere.
- Every authenticated call therefore returns `503` and spends nothing.
- No provider SDK, HTTP client or network call was added.

## Residual risk

The per-isolate rate limiter remains a **high-severity production issue**. It is
pre-existing and is not solved by M2; public AI endpoints must not launch until it
is replaced with a shared store (Cloudflare rate limiting rules, a Durable Object or
a database-backed counter). Likewise the web app still has no Content Security
Policy; the proposed policy must be verified on a preview deployment before it is
applied to production Pages headers.
## M2 phase 2 — added controls

| Control | Implementation | Honest limit |
|---|---|---|
| Verified email | `AuthClaims.emailVerified` from the `email_verified` claim; `AI_REQUIRE_VERIFIED_EMAIL` defaults to `true`; missing claim = unverified → `403` | Real verification status still requires a server-side check if a token omits the claim |
| Idempotency | `Idempotency-Key` replays the first successful answer per user+key, 10 min TTL, 500 entries | Per isolate; a retry routed elsewhere can run again |
| Cost limiter | Per-user daily run count (default 50), only enforced once an adapter is configured | Per isolate and in memory; **not** a security boundary and not a quota |
| Redacted logging | `ai.run.succeeded`, `ai.run.failed`, `ai.unavailable`, `ai.quota-exhausted` with request id, tool, latency and token counts | Never logs prompts, outputs, keys or provider bodies |
| Usage persistence | Interface prepared (`AiQuotaStore`); durable store not implemented | Needs a migration (Stage 7) |

`GET /api/v1/ai/status` still reports `quota: null`, because no durable allowance is
enforced. The per-isolate limiter is a damage limiter, not an entitlement.

## Content Security Policy (proposed, not applied)

The web app previously had no CSP. `apps/web/public/_headers` now carries a policy for
Cloudflare Pages. It is **not active** until the site is deployed, and the dev server
ignores it.

- `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`
- `script-src 'self'` — no `unsafe-inline`, no `unsafe-eval`; the theme bootstrap moved
  from an inline script to `public/theme-init.js` so this can be enforced
- `style-src 'self' 'unsafe-inline'` — Tailwind v4 injects a style element at runtime
- `img-src 'self' data: blob:` — local uploads, previews and thumbnails
- `connect-src 'self' https://*.supabase.co` — authentication only
- `Permissions-Policy: camera=(), microphone=(self), geolocation=()`

Automated coverage: `apps/web/src/__tests__/csp.test.ts` parses the header file and
asserts the required directives, the absence of `unsafe-inline`/`unsafe-eval`, the
image sources, the Supabase-only remote origin, the microphone allowance and the
HTML shell having no inline scripts or handler attributes.

**Still required:** a preview deployment to confirm the policy does not break
authentication, downloads or the editor, then owner approval to apply it to production.

## Rate limiting

The API limiter delegates to a `RateLimitStore`
(`apps/api/src/middleware/rate-limit-store.ts`):

- the default `InMemoryRateLimitStore` is a fixed-window counter held in worker
  memory — **per isolate**, so ten isolates mean ten times the allowance;
- `KvRateLimitStore` writes the counter to Cloudflare KV, so the limit is shared
  across isolates. KV is eventually consistent: a burst straddling the window
  boundary can briefly overshoot, and `get`+`put` is not atomic.

Binding `RATE_LIMIT_KV` to a KV namespace (or replacing the store with Cloudflare
rate-limiting rules or a Durable Object) is required before any public AI endpoint.
This remains a **high-severity** production blocker until that binding exists.

The same pattern applies to the AI daily quota: `InMemoryAiQuotaStore` is per
isolate; `KvAiQuotaStore` shares the allowance across isolates when `AI_QUOTA_KV`
is bound. The KV store is a genuine cross-isolate cost limiter, not a billing
ledger.

## M3 — all eight tools (offline acceptance)

Every tool now has an end-to-end offline acceptance test
(`apps/api/src/__tests__/ai-tools-m3.test.ts`) driven by the deterministic fake
provider and the shared pipeline. For each of the eight tools it proves:

- valid provider output is accepted and validated by that tool's output schema;
- the tool's `maxOutputTokens` from `AI_TOOL_LIMITS` reaches the provider request;
- invalid input is rejected **before** the provider is called;
- unknown output keys are stripped, and missing required fields reject with
  `invalid-response`.

Tool sample outputs live in `apps/api/src/__tests__/fixtures/tool-outputs.ts`. They
are test data only: they are never served, never used as a fallback, and never
presented to a customer as generated text.

What M3 still needs before customer exposure: a real provider adapter decision
(D1/D2), a funded cost envelope (D3/D15/D19), and the run endpoint's quota and
distributed rate limiting. None of those are implemented here, and no live call is
made by any test.
