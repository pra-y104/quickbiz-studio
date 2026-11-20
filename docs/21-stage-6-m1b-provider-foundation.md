# Stage 6 M1B: provider foundation (prepared, production-disabled)

This milestone adds the first real provider adapter **behind the existing M1A
contracts**, with production execution deliberately disabled. Nothing in this build
activates a provider, reads a key, makes a network call or charges a customer.

## Status at a glance

| Item | State |
|---|---|
| Gemini adapter | Implemented (`apps/api/src/ai/adapters/gemini.ts`) |
| HTTP transport | Implemented, single reviewed file (`ai/transport/http-transport.ts`) |
| Registered in production | **No** — `PRODUCTION_ADAPTERS` is still `[]` |
| Credentials | Server-side only; absent in this build, so `isConfigured()` is false |
| Live calls | None. All tests use a stub transport |
| `POST /api/v1/ai/run` | Still 501 |
| C7 / C8 | Still disabled |

## Adapter boundaries

```
apps/api/src/ai/
  provider.ts            AiProvider contract, AiProviderError (M1A, unchanged)
  execution.ts           pipeline, timeouts, cancellation, error mapping (M1A)
  registry.ts            sealed production registry, still empty (M1A)
  transport/
    http-transport.ts    the ONLY file allowed to call fetch
  adapters/
    gemini.ts            request building, response normalisation, error mapping
```

Rules the split enforces:

1. **The adapter never touches the network.** It receives an `AiJsonTransport`.
   Tests inject a stub, so the adapter is fully testable offline and in CI.
2. **The transport knows nothing about Gemini.** It sends JSON and returns
   `{ status, body, retryAfterSeconds }`. Provider specifics stay in the adapter.
3. **Credentials are passed per call**, read from Worker bindings by the caller,
   and never logged. The adapter puts the key in the `x-goog-api-key` header only —
   never in the URL, body, logs or error text.
4. **Errors are normalised twice**: the transport reports only `network` or
   `aborted`; the adapter maps everything to an `AiProviderErrorCode` with a fixed
   message from `SAFE_PROVIDER_MESSAGES` in the pipeline.

### ESLint boundary change (reviewed, minimal)

M1A banned all networking under `apps/api/src/ai/**`. M1B adds **one** exception
block, `quickbiz/ai-transport-exception`, scoped to
`apps/api/src/ai/transport/http-transport.ts`, and places it after the M1A block so
flat-config ordering does not defeat it. Verified with `--stdin` probes:

| Probe | Result |
|---|---|
| `fetch` in the transport file | ALLOWED (approved) |
| `fetch` in an adapter | BLOCKED |
| `globalThis.fetch` in the pipeline | BLOCKED |
| `undici` in the registry | BLOCKED |

The M1A boundary otherwise stands: `node:*`, `http`, `https`, `net`, `tls`,
`dgram`, `undici`, `ky`, `got`, `node-fetch`, `axios` and provider SDKs remain
banned everywhere under `ai/`, including adapters.

## The eight tools: capability and contract

All eight are defined in `packages/shared/src/ai/contracts.ts` and
`schemas.ts`. Gemini exposes one REST capability, `generateContent`, with JSON
output; the mapping is per tool, not per provider feature.

| Tool | Gemini capability | Input (validated) | Output (validated) | Limits (input chars / output tokens / temp) |
|---|---|---|---|---|
| `ai-writer` | `generateContent` + `responseMimeType: application/json` | documentType, topic, audience?, tone, length, language, keyPoints?, callToAction? | title, sections[{heading, body}], conclusion? | 8 000 / 1 200 / 0.6 |
| `ad-generator` | same | product, platform, objective, tone, language, offer? | headlines[], primaryText, description?, callToAction | 4 000 / 900 / 0.7 |
| `translator` | same | sourceText, sourceLanguage, targetLanguage, formality | translation, notes? | 6 000 / 1 500 / 0.3 |
| `text-improver` | same | text, goal, tone, language | improvedText, changes[] | 8 000 / 1 500 / 0.4 |
| `product-description` | same | productName, category, features[], platform, tone, price?, currency? | headline, description, bullets[], seoTitle? | 4 000 / 900 / 0.6 |
| `business-name-generator` | same | businessType, keywords[], style, language, count | names[{name, rationale}] | 2 000 / 800 / 0.8 |
| `social-caption` | same | platform, topic, tone, language, length, hashtags? | caption, hashtags[] | 3 000 / 700 / 0.7 |
| `business-plan-assistant` | same | businessName, audience, stage, sections[] | sections[{title, body}] | 2 000 / 2 500 / 0.5 |

Token and usage measurement:

- `maxOutputTokens` from `AI_TOOL_LIMITS` is sent as `generationConfig.maxOutputTokens`; the adapter must not raise it.
- `usageMetadata.promptTokenCount` → `inputTokens`, `candidatesTokenCount` → `outputTokens`, `totalTokenCount` → `totalTokens`.
- Missing usage is omitted, never estimated. The adapter only reports integers it received.

Timeout and cancellation:

- `executeAiTool` owns the single budget (`DEFAULT_AI_TIMEOUT_MS`, `MAX_AI_TIMEOUT_MS`) and passes one `AbortSignal` to `request.signal`.
- The adapter forwards that signal to the transport. A transport abort maps to `cancelled`; a pipeline timeout maps to `timeout` before the adapter can answer.
- Residual risk (unchanged): an adapter/transport that ignores the signal keeps running after the pipeline returns. Gemini's transport honours it; this must be asserted in adapter tests (it is).

Failure handling (all mapped to `AI_PROVIDER_ERROR_CODES`, never provider text):

| Provider condition | Code |
|---|---|
| No key / 401 / 403 | `not-configured` |
| 429 | `rate-limited` (+ `retryAfterSeconds` from `Retry-After`) |
| 5xx, transport error, `finishReason: OTHER` | `upstream` |
| Abort signal | `cancelled` |
| `finishReason: SAFETY`/`RECITATION`, `promptFeedback.blockReason` | `blocked` |
| `MAX_TOKENS`, empty text, unreadable body | `invalid-response` |

Cost estimation methodology:

- `AiCostEstimator` (M1A, unchanged) turns *provider-reported* usage into integer micros of the provider's billing currency using owner-supplied `AiPriceTable` rows.
- **No prices exist in this repository.** Any estimate before a real price table is `UNPRICED_ESTIMATE`.
- Final customer credit pricing is out of scope until provider invoices and infrastructure costs are known. No wallet, credit or payment code is added.

## Model selection (D2)

`AI_PROVIDER` / `AI_MODEL` remain preferences. The adapter uses `request.model`,
then the configured model, then a provisional default (`gemini-2.5-flash`) that
**must be verified against Google's documentation before activation**. The model
identifier is never hard-coded into a tool.

Routing rule: one configured provider per request. There is no automatic
fallback to a different provider or model — an unavailable model fails closed
rather than silently switching vendor, price or quality.

## Production gates before activation

1. Owner approval for provider, models and data-processing terms (D1, D2).
2. A funded cost envelope and a price table (D19); final credit pricing.
3. Server-side rate limiting that is not per-isolate (Stage 9 blocker).
4. A quota design enforced server-side (D3).
5. `POST /api/v1/ai/run` behind auth, wired through `describeAiFailure` (M2).
6. Privacy notice covering prompt retention and provider data use (D9).
7. `PRODUCTION_ADAPTERS` edited in a reviewed change to register the adapter.

## Testing (offline, no live calls)

`apps/api/src/__tests__/ai-gemini-adapter.test.ts` — 20 tests:

- not configured without a key; blank key; transport never called
- key in a header, never in URL or body
- per-tool token ceiling applied
- text / model (`modelVersion`) / finish reason / usage normalised
- usage omitted when absent; model fallback
- 429 with retry hint; 401/403; 5xx; network error; abort
- abort signal forwarded to the transport
- unreadable body, `MAX_TOKENS`, safety, prompt block
- provider text never appears in the error message
- production registry still empty

No test performs a network request; the transport is a stub. A live call would
require a key and explicit approval, and is not implemented.

## Future product requirements (recorded, not implemented)

### Template catalogue

- Administrators can upload, manage and publish graphic and video template packs over time.
- Packs load without rebuilding or redeploying the application.
- Search, categories, filters, previews, platform/format metadata.
- Versioning and retirement; free and premium classification.
- Separate graphic and video collections.
- The 24 Creative Studio templates are starter content, not a ceiling.

### Video studio

A future, genuinely editable video product — not a preset gallery:

- multi-track timeline, clip replacement, trimming and splitting
- text overlays, animation, audio tracks and fades, transitions
- preview and tested export for TikTok, Instagram Reels, Facebook and YouTube
- export format is the hard constraint: browser `MediaRecorder` produces WebM, while these platforms expect MP4. Options are WebCodecs + an in-browser muxer (new dependency, approval needed) or a paid server-side FFmpeg worker. A discovery spike is required before committing.

Neither is in M1B scope and neither is funded.

## Residual risks

| Risk | Severity | Status |
|---|---|---|
| In-memory API rate limiting | High for production | Pre-existing, Stage 9 blocker; does not apply to M1B because no endpoint is live |
| Provisional default model id | Medium | Must be verified before activation |
| No server-side quota | High for production | M2/D3 |
| Transport is a new network path in the worker | Medium | Narrowly scoped, lint-enforced, no key in this build, abort-aware |
| Provider free tiers are not a production allowance | Medium | No free tier assumed anywhere |