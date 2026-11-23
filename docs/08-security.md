# Security requirements

Security is a product feature. Nothing in this document may be traded away for speed.

## Authentication (Stage 4)

- Identity comes only from a verified Supabase access token. Request bodies, query
  strings and custom headers cannot name a user.
- The API fails closed: no verification configuration means 503, never an implicit
  anonymous identity.
- The browser holds the public anon key only. The service-role key bypasses RLS and is
  never referenced by the web app.
- Profile rows are readable and writable only by their owner; updates are limited by
  column grants to display name, avatar URL and preferred locale.
- Recovery and registration responses are identical for known and unknown addresses, so
  neither screen can enumerate accounts.
- All post-auth redirects pass through `safeNextPath`, which rejects external URLs,
  protocol-relative URLs and control characters.
- Sign-out clears local state even when the provider call fails.

## Controls in place today (Stage 2)

| Area | Control | Where |
|---|---|---|
| Secrets | Only public `VITE_*` values reach the browser; server keys stay in Worker secrets | `apps/web/src/lib/env.ts`, `apps/api/src/config/env.ts` |
| Config validation | Bindings validated with Zod, clear failure on misconfiguration | `apps/api/src/config/env.ts` |
| Transport | HTTPS only in production; HSTS header | `security-headers.ts` |
| Headers | `nosniff`, `DENY` framing, strict API CSP, `no-referrer` | `security-headers.ts` |
| Caching | API responses `no-store` | `security-headers.ts` |
| CORS | Explicit allowlist, no wildcard, preflight handled centrally | `middleware/cors.ts` |
| Input validation | Every endpoint validates with a shared Zod schema | `lib/validate.ts` |
| Error hygiene | Internal messages and stacks never leave the server | `middleware/error-handler.ts` |
| Logging | Structured logs with automatic secret redaction | `lib/logger.ts` |
| Rate limiting | Fixed window per client and path (per isolate - see limitation) | `middleware/rate-limit.ts` |
| Dependencies | Lockfile committed, builds reproducible, CI installs with `--frozen-lockfile` | `pnpm-lock.yaml`, CI |
| Source hygiene | `.env`, `.dev.vars`, build output and caches gitignored | `.gitignore` |

## Known limitations (must be closed before paid launch)

1. **Rate limiting defaults to per isolate.** The limiter now delegates to a
   `RateLimitStore` (`apps/api/src/middleware/rate-limit-store.ts`): the default
   `InMemoryRateLimitStore` is per isolate, while `KvRateLimitStore` shares the
   counter across isolates when a KV namespace is bound. KV is eventually
   consistent, so a burst can briefly overshoot; Cloudflare rate-limiting rules or
   a Durable Object are stricter. Binding KV (or the native rule) is required
   before any public AI endpoint.
2. **AI quota is cost-limiting, not billing.** `InMemoryAiQuotaStore` is per
   isolate; `KvAiQuotaStore` shares the daily allowance across isolates when
   `AI_QUOTA_KV` is bound. Neither is a billing ledger; the wallet ledger is.
3. **Authentication is implemented but not verified against a live project.** JWT
   verification, the verified-email gate and cross-user isolation are implemented
   and unit-tested; a real Supabase project must be connected and exercised before
   launch.
4. **CSP is committed and unit-tested, not deploy-verified.** The policy in
   `apps/web/public/_headers` must be loaded in a real deployment to confirm it
   does not break auth, downloads or the editors.
5. **No dependency vulnerability scanning in CI yet.** Add `pnpm audit --prod` or
   Dependabot.
6. **No penetration test.** A manual security review is required before real money
   is accepted.
7. **No browser or device testing has been performed.** The test suite is
   unit/integration only; a manual Android and desktop QA pass is still required.

## Rules for money

- Balances and prices are never accepted from the browser.
- Credit changes happen only inside a Postgres transaction with a row lock.
- Every change writes a ledger row with an idempotency key.
- Payment credit is granted only from a verified, signature-checked webhook stored in
  `payment_events` with a unique provider event id (replay protection).
- A reversal is automatic for qualifying technical failures.
- Reconciliation compares the ledger sum against the stored balance and alerts.

## Rules for AI

- Provider keys are Worker secrets, never in the bundle.
- Prompts and outputs are not logged in full.
- Inputs are length-capped and validated before any provider call.
- Provider errors are mapped, not echoed.

## Privacy

- Collect the minimum needed: email, display name, country, locale, timezone.
- Publish a retention policy before launch; support export and deletion.
- Hash IPs and device signals used for abuse detection.
- Disclose any AI provider data-use terms in the privacy policy.

## Pre-launch security checklist

- [ ] Rate limiting moved to shared storage
- [ ] JWT verification on all protected routes, tested with forged tokens
- [ ] Cross-user access attempts return 403/404, tested
- [ ] Balance tamper attempts via direct API calls fail, tested
- [ ] Webhook replay rejected, tested in sandbox
- [ ] Secrets rotated and stored only in the platform secret stores
- [ ] Dependency audit clean or triaged
- [ ] Backups enabled and a restore has been tested
- [ ] Incident contact and rollback procedure documented
