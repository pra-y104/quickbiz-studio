# Testing

## What runs today

| Suite | Tool | Location | Purpose |
|---|---|---|---|
| Shared contracts | Vitest | `packages/shared/src/__tests__` | catalogue invariants, currency math, date formatting, schema behaviour |
| API integration | Vitest | `apps/api/src/__tests__` | real Hono middleware chain: health, catalogue, validation, CORS, headers, rate limit, error hygiene |
| Web components | Vitest + Testing Library | `apps/web/src/**/*.test.tsx` | button states, api client contract, foundation page copy and links |

Current result: **41 tests passing** (19 shared, 12 API, 10 web).

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
| 3 | homepage render, navigation, theme switching, responsive smoke |
| 4 | register/verify/login/reset flows, free grant idempotency, JWT rejection |
| 5 | every calculator edge case (0, negative, huge, leap year, absolute zero) |
| 6 | provider adapter mapping, timeout, credit reservation and reversal |
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
