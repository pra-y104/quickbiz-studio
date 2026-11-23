# Stage 9 — security and quality assurance

This is the QA record. It states what is verified by automated tests, what is
verified by review, and what is **not** verified. Nothing here has been tested in a
real browser: the suites are unit and integration only.

## 1. Automated suites

| Suite | Count | What it proves |
|---|---|---|
| Shared (`packages/shared`) | 219 | catalogue invariants, currency/date maths, tool logic, Creative Studio document model, Video Studio document model, wallet ledger invariants, locale model |
| API (`apps/api`) | 176 | real Hono middleware chain: health, tools, auth, AI guards, rate limiting, idempotency, logging redaction, payments, Paystack adapter, translation |
| Web (`apps/web`) | 311 | every tool, auth screens, guards, Creative Studio, Video Studio timeline, wallet page, locale menu, CSP header |

Run `pnpm verify` for typecheck, lint, tests and both builds.

## 2. Security controls verified by tests

- Authentication required on AI, payments and translation routes (401 without a
  verified token).
- Verified-email gate fails closed.
- AI runs fail closed with 503 while no provider is registered.
- Payment checkout fails closed with 503 without a test-mode provider.
- Webhook signatures: valid accepted, invalid rejected, tampered body rejected,
  stale timestamped signatures rejected.
- Paystack adapter refuses live keys and never calls the network in tests.
- Logger redacts `authorization`, `api_key`, `password`, `secret`, `token`,
  `service_role_key`.
- Rate-limit store isolates by client and path, expires, and shares across
  instances on one KV namespace.
- AI quota allows exactly `MAX_AI_RUNS_PER_DAY` and then blocks; KV store shares
  the allowance across isolates.
- Wallet ledger: no overdraft, no duplicate ids, no currency mismatch, reserve/
  settle/release semantics, concurrent double-spend refused.
- Video project files: rejects malformed JSON, unknown node types, oversize
  payloads, wrong `kind`/`version`.

## 3. Verified by review (no automated test)

- `apps/web/public/_headers` CSP directives and the CSP-safe HTML shell; the
  header has never been loaded by a real deployment.
- SQL migrations are reviewed by reading; they have **not** been applied to any
  database, so RLS behaviour is unproven in practice.
- Accessibility: components use semantic elements, visible focus rings, `aria-*`
  labels and `role="status"` notices, but no axe/Lighthouse audit has been run.
- Responsive layout: Tailwind breakpoints are present; no device screenshots.

## 4. Explicitly NOT verified (blockers)

| Item | Why it matters |
|---|---|
| Real browser rendering | Layout, CSP interaction, IndexedDB persistence and export are untested end to end |
| Android/desktop manual QA | The editor and Video Studio have never been opened on a phone |
| Supabase connectivity | `VITE_SUPABASE_*` / `SUPABASE_*` are not visible to the sandbox, so no live auth or DB call has succeeded |
| Database migrations | `0001`–`0004` are written but unapplied; wallet RLS is unproven |
| Dependency audit | `pnpm audit` has not been run in CI |
| Penetration test | Not performed |

## 5. Recommended order of work before launch

1. Apply migrations `0001`–`0004` to a Supabase project and verify RLS with two
   test users (owner approval required).
2. Bind `RATE_LIMIT_KV` and `AI_QUOTA_KV`, or replace the limiter with
   Cloudflare rate-limiting rules.
3. Deploy a preview and load the CSP in a real browser; fix any breakage.
4. Run the manual QA matrix on Android and desktop.
5. Run `pnpm audit --prod` and triage findings.
6. Supply legal details, then remove the draft banners.