# Roadmap

Each stage ends with a working build, tests, and a short honest report. No stage
starts before the previous one is reviewed.

| Stage | Scope | Status |
|---|---|---|
| 1 | Architecture report and decisions | Complete - approved |
| 2 | Repository foundation, design system, API skeleton, CI, docs | Complete - awaiting review |
| 3 | Brand identity, homepage, navigation, footer | Complete - awaiting review |
| 4 | Auth (register, verify, login, reset), profile, dashboard shell | Complete - awaiting review |
| 5 | Ordinary tools: calculator, percentage, unit, date, word count, text formatter, invoice, quotation | Next |
| 6 | AI tools behind the provider adapter, credit cost display | Planned |
| 7 | Wallet: ledger, atomic spend, reversals, history, saved results | Planned |
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
- 115 automated tests pass across shared, API and web.
- Free allowance granting is intentionally deferred; it belongs with credits (Stage 7).

**Stage 5**
- Every ordinary tool produces correct output, verified by unit tests.
- Tools work without an account and without credits.
- Invoice output downloads as a usable file.

**Stage 6**
- All eight AI tools return real provider output.
- Credit cost is shown and confirmed before submission.
- Failure paths return credits automatically.
- No key or prompt is visible in the client bundle.

**Stage 7**
- Concurrent spend cannot overdraw a wallet.
- Ledger sum always equals stored balance.
- Duplicate submission charges once.
- Full history visible to the user.

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
