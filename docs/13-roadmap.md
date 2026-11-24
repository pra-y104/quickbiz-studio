# Roadmap

Each stage ends with a working build, tests, and a short honest report. No stage
starts before the previous one is reviewed.

| Stage | Scope | Status |
|---|---|---|
| 1 | Architecture report and decisions | Complete - approved |
| 2 | Repository foundation, design system, API skeleton, CI, docs | Complete - awaiting review |
| 3 | Brand identity, homepage, navigation, footer | Complete - awaiting review |
| 4 | Auth (register, verify, login, reset), profile, dashboard shell | Complete - awaiting review |
| 5 | Ordinary tools: calculator, percentage, unit, date, word count, text formatter, invoice, quotation | Complete - awaiting review |
| 6 | AI tools behind the provider adapter (M0 + M1A + M1B complete) | In progress - M1B delivered, awaiting review |
| 7 | Wallet: ledger, atomic spend, reversals, history, saved results, AI credit settlement | Planned |
| 8 | Paystack integration (sandbox first), webhook verification, purchase flow | Blocked on owner decision and business onboarding |
| 9 | QA, accessibility, performance, CSP, deployment, monitoring | Planned |
| 10 | Handover: docs, export, transfer instructions | Planned |

## Stage acceptance criteria

**Stage 3**
- Homepage communicates the product in one screen without generic filler.
- Navigation works on 360 px width; light and dark themes reviewed.
- Customer promise section is present and accurate.
- No claim about AI or payments that the build cannot honour.

**Stage 3 (delivered)**
- Homepage covers hero, both tool showcases, how it works, pricing introduction,
  customer promise, trust, questions and closing CTA.
- Navigation works at 360 px with a keyboard-accessible mobile drawer.
- Light and dark themes reviewed; the dark hero band is intentional.
- No invented prices, testimonials, customer counts or legal links.
- 53 automated tests pass across shared, API and web.

**Stage 4**
- A real account can be created, verified and used to sign in on an Android phone.
- Password reset works end to end.
- API rejects unauthenticated and forged-token requests.
- Users can read and update only their own profile, and only editable columns.

**Stage 4 (delivered)**
- Register, verify, sign in, resend, forgot and reset screens are built on the Stage 2/3
  design system and work at 360 px in both themes.
- Auth is inert without a Supabase project: forms are disabled and the reason is shown.
- Protected routes wait for session restoration, then redirect with a safe `next` path.
- Profiles are protected by RLS and column grants; privileged fields are not writable.
- 119 automated tests pass across shared, API and web.
- Free allowance granting is intentionally deferred; it belongs with credits (Stage 7).

**Stage 5**
- Every ordinary tool produces correct output, verified by unit tests.
- Tools work without an account and without credits.
- Invoice output downloads as a usable file.

**Stage 5 (delivered)**
- Eight tools are live at `/tools` with a searchable, filtrable directory.
- All calculation logic is pure and unit-tested in `packages/shared/src/tools`.
- Invoices and quotations share one totals engine and one PDF layout; the downloaded
  file is a real PDF with a verified cross-reference table.
- No tool requires an account, a credit, a network request or an environment variable.
- 262 automated tests pass across shared, API and web.
- AI tools remain `planned` and unpriced, so nothing can be charged yet.

**Stage 6**
- All eight AI tools return real provider output.
- No key or prompt is visible in the client bundle.
- Credit cost display, deduction and automatic reversal belong to Stage 7 (decision D6).

**Stage 6 (M0 delivered)**
- Shared input/output contracts exist for all eight AI tools and are the single source
  of truth for the API, prompts and tests.
- Every prompt has a version string owned by shared code; a run cannot record a version
  that differs from the wording that produced it.
- Test-only escaping proves pasted text cannot close the user-data block in a prompt.
- `GET /api/v1/ai/status` reports `configured: false` with reason
  `no-adapters-registered`, and `quota: null`; naming `AI_PROVIDER` does not enable AI.
- `POST /api/v1/ai/run` returns 501; no adapter, key, network call or migration exists.
- All eight AI tools remain `planned` with `creditCost: null`.
- 291 automated tests pass across shared, API and web.

**Stage 6 (M1A delivered)**
- A provider-independent contract supports cancellation, a hard timeout, normalised
  finish reason and usage metadata.
- `executeAiTool()` validates input, applies the budget, and validates output against
  the tool schema; malformed responses are rejected with a shared reason.
- A deterministic fake provider exercises the pipeline offline and is excluded from
  the production barrel; ESLint bans network calls, vendor SDKs and test-double
  imports in production AI code.
- The production registry is empty, so `/api/v1/ai/status` stays unavailable and
  `POST /api/v1/ai/run` stays 501 even when `AI_PROVIDER` is set.
- Cost interfaces exist with no prices; no wallet, credits or billing code is added.
- 559 automated tests pass across shared, API and web.

**Stage 6 (M1B delivered)**
- Real provider adapters (Gemini, OpenAI-compatible) behind the provider-independent
  contract; all fail-closed until a credential is present and `AI_ENABLED=true`.
- Streaming transport (`executeAiToolStream`) with schema-validated final event;
  non-streaming pipeline remains the reference path.
- Bounded retries with exponential backoff and provider failover on transient
  failures (`upstream`, `timeout`); `rate-limited` is terminal so callers honor
  `retryAfterSeconds`.
- `POST /api/v1/ai/run` is authenticated, verified-email gated, idempotency-keyed,
  quota-limited (per-user per-day, pluggable KV/memory store), and fail-closed when
  no provider is configured.
- `GET /api/v1/ai/status` reports the actually-configured providers; ESLint keeps
  non-adapter AI modules network-free (adapters are the reviewed `fetch` boundary).
- All eight AI tools remain `planned` with `creditCost: null`; credit display,
  deduction and reversal belong to Stage 7.
- ESLint bans vendor SDKs, Node networking and test-double imports in production AI
  code; the fake provider is test-only.

**Stage 7**
- Concurrent spend cannot overdraw a wallet.
- Ledger sum always equals stored balance.
- Duplicate submission charges once.
- Full history visible to the user.
- AI credit display, deduction and automatic reversal land here, not in Stage 6.

**Stage 8**
- Sandbox purchase grants credits exactly once.
- Webhook signature failure and replay are rejected.
- Fees and onboarding requirements verified from official provider documents.

**Stage 9**
- Test matrix completed on real devices.
- Rate limiting moved to shared storage, CSP applied, dependency audit triaged.
- Deployed to production with a verified live request.

**Stage 10**
- A fresh clone builds from the README alone.
- Source can be exported, transferred and redeployed elsewhere.
