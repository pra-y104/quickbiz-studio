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