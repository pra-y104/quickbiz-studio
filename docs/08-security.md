# Security requirements

Security is a product feature. Nothing in this document may be traded away for speed.

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

1. **Rate limiting is per isolate.** Replace with Cloudflare rate limiting rules or
   KV/Durable Objects. Without this, a distributed attacker can exceed the intended
   limit.
2. **No authentication yet.** JWT verification lands in Stage 4. Until then the API
   exposes only public read-only endpoints.
3. **No CSP for the frontend yet.** Add a strict Content-Security-Policy at Pages
   level once the asset list is stable (Stage 9).
4. **No dependency vulnerability scanning in CI.** Add `pnpm audit --prod` or
   Dependabot at Stage 9.
5. **No penetration test.** A manual security review is required before real money
   is accepted.

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
