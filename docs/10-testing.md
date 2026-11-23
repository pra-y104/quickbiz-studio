# Testing

## What runs today

| Suite | Tool | Location | Purpose |
|---|---|---|---|
| Shared contracts | Vitest | `packages/shared/src/__tests__` | catalogue invariants, brand config, currency math, date formatting, schemas |
| Shared tool logic | Vitest | `packages/shared/src/__tests__` | calculator parser, percentages, units, calendar maths, text statistics and transforms, document totals |
| API integration | Vitest | `apps/api/src/__tests__` | real Hono middleware chain: health, catalogue, validation, CORS, headers, rate limit, error hygiene |
| Web components | Vitest + Testing Library | `apps/web/src/**/*.test.tsx` | button states, api client contract, homepage sections, navigation drawer, theme toggle |
| Auth screens and guards | Vitest + Testing Library | `apps/web/src/pages/auth`, `src/components/auth`, `src/lib/auth` | validation, provider state, protected redirects, logout, recovery states, safe next paths, profile payload |
| Ordinary tools | Vitest + Testing Library | `apps/web/src/pages/tools`, `src/components/tools`, `src/lib/tools` | every tool interaction, validation states, PDF structure and printed totals |
| Creative Studio | Vitest | `packages/shared/src/__tests__/creative-*.test.ts`, `apps/web/src/lib/creative/__tests__/*` | document validation, geometry, commands, history, renderer, export, ingest, project store |
| AI foundation | Vitest | `packages/shared/src/__tests__/ai-contracts.test.ts`, `apps/api/src/__tests__/ai-*.test.ts` | contract parity, prompt versions, provider registry, fake-provider pipeline, timeout, cancellation, output validation, isolation guards, rate-limit store, AI quota (memory + KV), logger redaction |
| Video Studio | Vitest | `packages/shared/src/__tests__/video-*.test.ts`, `apps/web/src/lib/video/*.test.ts` | document validation, split/remove/add, project-file round-trip, timeline layout |
| Wallet | Vitest | `packages/shared/src/__tests__/wallet-ledger.test.ts` | derived balance, no overdraft, idempotent entries, reserve/settle/release, concurrent double-spend |
| Payments | Vitest | `apps/api/src/__tests__/payments*.test.ts`, `paystack.test.ts` | signature verification, amount checks, fail-closed checkout, webhook ack, test-mode only |
| Translation | Vitest | `apps/api/src/__tests__/translate.test.ts` | auth required, language validation, fail-closed 503 |
| Globalisation | Vitest | `packages/shared/src/__tests__/locale.test.ts`, `apps/web/src/lib/locale`, `components/layout/locale-menu.test.tsx` | locale model, preferences, menu behaviour |

Current result: **712 tests passing** (219 shared, 180 API, 313 web). See
`docs/24-stage-9-qa.md` for what the suites do **not** cover.

## Commands

```bash
pnpm typecheck     # all workspaces
pnpm lint          # ESLint flat config
pnpm test          # all test suites
pnpm build         # web build + worker bundle validation
pnpm verify        # everything above, in order
```

## What each stage must add

| Stage | New tests |
|---|---|
| 3 | homepage render, navigation drawer, theme switching, no dead links (done) |
| 4 | registration/login validation, auth state, protected routes, logout, recovery, profile fields (done) |
| 4 | register/verify/login/reset flows, free grant idempotency, JWT rejection |
| 5 | every calculator edge case (0, negative, huge, leap year, absolute zero) (done) |
| 6 | provider contract, registry fail-closed, fake-provider pipeline, timeout, cancellation, malformed output (M0 and M1A done); adapter mapping in M1B; credit reservation and reversal in Stage 7 |
| 7 | atomic spend under concurrency, ledger reconciliation, idempotent replay |
| 8 | webhook signature failure, replay rejection, amount mismatch, sandbox purchase |
| 9 | Playwright end-to-end on phone viewport, accessibility audit, performance budget |

## Manual QA matrix (every stage)

- 360×640 Android, 390×844 iPhone, 768×1024 tablet, 1440×900 laptop.
- Light and dark theme.
- Keyboard-only navigation and visible focus.
- Slow network: loading states appear and do not jump.
- Failure states: offline, server 500, validation error.
- No horizontal scroll at any width.

## Rules

- A feature is not complete because it renders. It is complete when the happy path
  and the main failure path both have evidence.
- Tests must not depend on real keys, real payments or real provider calls.
- Never report a passing test that was not run.
