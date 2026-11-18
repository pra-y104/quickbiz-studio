# Backend development

## Runtime

Cloudflare Workers, TypeScript, Hono. The worker is always awake, runs close to the
user and needs no server maintenance. The bundle is validated with
`wrangler deploy --dry-run`.

## Folder structure

```
apps/api/src/
  app.ts              middleware chain + route mounting
  index.ts            worker entry point
  ai/                 provider contract and registry (no provider in Stage 2)
  config/env.ts       validated bindings and defaults
  lib/                errors, responses, logging, validation
  middleware/         request context, cors, security headers, rate limit, error handler
  routes/             health, meta, tools
  types/              request context types
  __tests__/          integration tests against the real middleware chain
```

## Request pipeline

```
request
  → requestContext     (request id + config + structured log)
  → cors               (allowlist only)
  → securityHeaders    (nosniff, DENY framing, strict CSP, no-store)
  → rateLimit          (/api/* only)
  → route handler      (validate → service → response)
  → errorHandler       (stable envelope, no internal leakage)
```

## Response contract

Success:

```json
{ "data": { "...": "..." }, "requestId": "9f2c..." }
```

Failure:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields need attention.",
             "details": [{ "path": "kind", "message": "Invalid option" }],
             "requestId": "9f2c..." } }
```

Codes come from `@quickbiz/shared` so the client can switch on them safely.

## Adding an endpoint

1. Define the input schema in `packages/shared/src/schemas/` if it is shared.
2. Create or extend a route file in `src/routes/`.
3. Validate with `parseOrThrow(schema, input)` - never trust raw input.
4. Return `ok(c, data)`; throw `AppError.*` for failures. Do not build ad-hoc error JSON.
5. Add a test in `src/__tests__/` covering success and the main failure path.
6. If the endpoint is authenticated, verify the JWT and derive the user id from the
   token (Stage 4). Never accept a `userId` from the body.

## Existing endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness, version, environment |
| GET | `/` | service card |
| GET | `/api/v1` | endpoint index |
| GET | `/api/v1/meta` | public platform metadata |
| GET | `/api/v1/tools` | read-only tool catalogue with filters |

## Configuration

`src/config/env.ts` validates every binding with Zod once per isolate and throws a
clear `ConfigurationError` when something is wrong. Defaults are safe for local
development only; production values are set in the Cloudflare dashboard.

## Logging

`src/lib/logger.ts` emits one JSON line per event. Sensitive keys (`authorization`,
`token`, `password`, `secret`, API keys) are redacted automatically. Never log full
prompts or full results.

## Error handling

`AppError` carries `code`, HTTP `status`, a user-safe message and optional details.
`errorHandler` logs 5xx with a stack and returns a generic message, so internal
details never reach the browser.

## Rate limiting (current limitation)

The in-memory fixed window is per isolate, not global. It stops runaway loops and
casual abuse only. Before public launch this must be replaced by Cloudflare rate
limiting rules, KV or Durable Objects. Tracked in [08-security.md](./08-security.md).

## Local development

```bash
pnpm install
pnpm dev:api          # wrangler dev on http://localhost:8787
pnpm dev:web          # vite on http://localhost:5173
```

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` for local secrets. That
file is gitignored.

## Deployment

`pnpm build:api` validates the bundle. `pnpm --filter @quickbiz/api deploy` publishes
to the production environment; it requires a Cloudflare login and must be run by the
owner or CI with a scoped token.
