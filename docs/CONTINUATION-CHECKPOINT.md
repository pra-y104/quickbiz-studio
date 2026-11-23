# Continuation checkpoint

This file exists so the next session can resume without repeating work. It is a
checkpoint, **not** a completion report. The roadmap is not finished.

## Where to resume

| Item | Value |
|---|---|
| Branch | `stage-6-p1-templates` |
| Latest commit at time of writing | `2f66a58` (plus the commit that adds this file) |
| Main | `12f1712` — untouched, no merge performed |
| Tests | 635 passing (189 shared, 142 API, 295 web) |
| Working tree | clean |

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

## Next tasks, in order

1. **M4 — premium AI interface** (`apps/web/src/pages/tools/ai/*`, API client):
   forms from `AI_TOOL_SCHEMAS`, result panel with copy/download/regenerate, loading
   and error states, honest "AI unavailable" state while `PRODUCTION_ADAPTERS` is
   empty.
8. **M5 — AI security review**: shared-store rate limiting design, quota
   enforcement, abuse tests, redacted-log assertions.
3. **Video Studio**: new `creative/video/*` — document model, timeline, preview via
   `<video>`, WebM export via `MediaRecorder` (labelled honestly, never "MP4").
4. **Wallet persistence + UI**: `creative_projects`-style Supabase tables with RLS
   (needs migration approval) and a wallet page reading server-side balances.
5. **Payments**: map `PaymentProvider` onto Paystack's API shape (test-mode only),
   signed webhook route, reconciliation job.
6. **Globalisation**: locale switcher over complete catalogues, currency switcher for
   display, regional date/number formats.
6. **Stage 9**: browser/device QA matrix, accessibility audit, dependency audit.
7. **Stage 10**: preview deployment verification of the CSP, then production approval.

## Blockers that need the owner

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` are **not visible**
  to the sandbox. Add `apps/web/.env.local` (git-ignored) and
  `wrangler secret put` values to verify authentication.
- Migration approval for any wallet/project tables and RLS.
- Business name, address, jurisdiction, support and privacy email for the legal pages.
- AI provider decision (D1/D2) and funding (D3/D15/D19).
- Paystack onboarding for live payments.
- Production deployment and CSP approval.

## Known high-severity gaps

1. Per-isolate rate limiting (`apps/api/src/middleware/rate-limit.ts`) — needs a
   shared store before any public AI endpoint.
2. CSP is committed and unit-tested but **not deploy-verified**.
8. No browser or device testing has been performed anywhere in this project.

## Rules for the next session

- Do not merge to `main`, deploy, apply migrations, activate providers or incur cost.
- Keep changes scoped to Creative Studio, M2/M3, wallet, payments and globalisation.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`,
  `pnpm build:web`, `pnpm build:api` before every commit.
- Do not delete or weaken existing tests.