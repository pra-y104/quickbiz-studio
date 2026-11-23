# Continuation checkpoint

This file exists so the next session can resume without repeating work. It is a
checkpoint, **not** a completion report. The roadmap is not finished.

## Where to resume

| Item | Value |
|---|---|
| Branch | `stage-6-p1-templates` |
| Main | `12f1712` — untouched, no merge performed |
| Tests | 706 passing (219 shared, 176 API, 311 web) |
| Working tree | clean at the last commit |

## Completed and pushed on this branch

| Work | Commits |
|---|---|
| Creative Studio C0–C6 (editor, templates, export, mobile) | `6ff3830`, `81ce4d1`, `3b89985` |
| Review remediation H1–H4, M1–M10 | `04dced1` |
| P0 mobile editing, save ordering, selection | `586fee8` |
| P1 real template previews + pack catalogue | `19eb9ad` |
| P2 alignment, zoom, page settings | `166e5b9` |
| Translator voice (STT, TTS, audio controls) | `7a424a0` |
| M2 authenticated, fail-closed run endpoint | `a81c786` |
| M2 verified email, idempotency, cost limiter, redacted logs | `4b4f0a8`, `2aa80f3` |
| CSP + CSP-safe shell + tests | `f9f174b` |
| M3 offline acceptance for all eight tools | `1447200`, `5ac588d` |
| T3 legal pages with honest placeholders | `fe93023` |
| Stage 7 wallet ledger domain | `8812374` |
| Stage 8 payment provider contract + signature verification + simulation | `8812374` |
| Stage 10 deployment and handover guide | `2f66a58` |
| Continuation checkpoint | `3969905` |
| M4 AI tool pages (all eight, honest unavailable state) | `6160a1a` |
| M5 shared-store rate limiting abstraction | `46dc522` |
| Video Studio: model, timeline, preview, WebM export | `2e5ff21` |
| Wallet `0004` migration + customer wallet UI | `5078a76` |
| Paystack test-mode adapter + payment routes | `516506c` |
| Translation route + translator wiring | `7536843` |
| Globalisation: locale/currency preferences, prepared languages | `f8329ce` |
| Durable KV AI quota wired into the run route | `7e7c9d2` |

## Next tasks, in order

1. **Stage 9 QA**: `docs/24-stage-9-qa.md` records what is tested. Remaining
   automated work: a dependency audit run (`pnpm audit --prod`) and, if practical,
   an accessibility-oriented component test pass.
2. **Video Studio polish**: project import is implemented; consider a media
   browser, keyboard shortcuts, and drag-to-trim if time allows.
3. **Docs**: keep `docs/08-security.md`, `docs/22-…m2…md`, `docs/23-…deployment.md`
   and `docs/24-…qa.md` in step with the code.
4. **Stage 10**: a preview deployment to load the CSP in a real browser, then owner
   approval for production. Never deploy without explicit approval.

## Blockers that need the owner

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` are **not visible**
  to the sandbox. Add `apps/web/.env.local` (git-ignored) and
  `wrangler secret put` values to verify authentication and the database.
- Migration approval for `0001`–`0004` (wallets + RLS are unapplied).
- Business name, address, jurisdiction, support and privacy email for the legal pages.
- AI provider decision and funding.
- Paystack live onboarding for live payments.
- Cloudflare KV namespace bindings for `RATE_LIMIT_KV` and `AI_QUOTA_KV`.
- Production deployment and CSP approval.

## Known high-severity gaps

1. Rate limiting and AI quota fall back to per-isolate memory unless
   `RATE_LIMIT_KV` / `AI_QUOTA_KV` are bound.
2. CSP is committed and unit-tested but **not deploy-verified**.
3. No browser or device testing has been performed anywhere in this project.
4. Database migrations are written but unapplied, so wallet RLS is unproven.

## Rules for the next session

- Do not merge to `main`, deploy, apply migrations, activate providers or incur cost.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
  `pnpm build:web`, `pnpm build:api` before every commit.
- Do not delete or weaken existing tests.