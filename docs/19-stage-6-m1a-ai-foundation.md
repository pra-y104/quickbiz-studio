# Stage 6 M1A: provider-independent AI foundation

M1A builds the machinery around a provider without adding one. The registry stays
empty, the HTTP surface stays disabled, and every test runs offline against a
deterministic fake.

## What exists

| Piece | Location |
|---|---|
| Provider contract, normalised request/response, error class | `apps/api/src/ai/provider.ts` |
| Registry, production instance, availability description | `apps/api/src/ai/registry.ts` |
| Execution pipeline (timeout, cancellation, output validation) | `apps/api/src/ai/execution.ts` |
| Cost-estimation interfaces (no prices) | `apps/api/src/ai/cost.ts` |
| Deterministic test double | `apps/api/src/ai/testing/fake-provider.ts` |
| Production barrel (excludes testing) | `apps/api/src/ai/index.ts` |
| Shared execution metadata types | `packages/shared/src/ai/execution.ts` |
| Shared provider error codes | `packages/shared/src/ai/errors.ts` |

## Provider contract

```ts
interface AiProvider {
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  isConfigured(): boolean;
  generate(request: AiGenerateRequest): Promise<AiGenerateResponse>;
}
```

`AiGenerateRequest` carries the tool identity, the composed system instruction, the
delimited user turn, optional model override, the per-tool temperature and output
ceiling, and an `AbortSignal`. `AiGenerateResponse` is normalised to `text`,
`providerId`, `model`, `finishReason` and optional `usage`; vendor fields are dropped
at the adapter edge so no provider shape leaks into the interface.

Adapters may only reject with `AiProviderError`, whose `code` is a member of the
shared `AI_PROVIDER_ERROR_CODES` list. The list deliberately excludes `quota`: an
allowance is a platform decision, never a provider one.

## Registry and configuration

- `AiProviderRegistry` is an allow-list with duplicate-id and id-format guards.
- `productionRegistry` is empty. No configuration path can register an adapter.
- `require(id)` fails closed: a missing or unconfigured provider throws, and there is
  no fallback to another provider.
- `describeAiAvailability(config, registry)` derives `configured` and `reason` from
  the registry only. `AI_PROVIDER` / `AI_MODEL` are echoed as a preference and cannot
  make AI available.
- Invalid configuration fails at startup (`ConfigurationError`), and the worker
  returns a generic 500 without echoing the bad value.

## Execution pipeline

`executeAiTool({ tool, input, provider, model?, signal?, timeoutMs? })`:

1. **Validate input** with the tool's input schema. An invalid request throws a
   `ZodError` before any provider call is made.
2. **Build the prompt** from the versioned template; the output contract is appended
   to the immutable system instruction. Templates are unchanged from M0.
3. **Call the provider** with one budget: caller cancellation or the timeout aborts a
   single internal signal, and the pipeline races that abort against the adapter
   promise. An adapter that ignores the signal still cannot hang the request.
4. **Reject unusable responses**: empty text, `content-filter` → `blocked`,
   `length` (truncated) → `invalid-response`, `error` → `upstream`.
5. **Parse and validate JSON** against the tool's output schema. Unknown keys are
   stripped; missing or mistyped fields reject with `invalid-response`. Only field
   paths are surfaced, never the model's text or the caller's input.
6. **Return** `{ output, metadata }` with provider id, model, prompt version, finish
   reason, usage when reported, and measured latency.

Error mapping is total: any unexpected adapter failure becomes `upstream` with a
generic message, so internal hostnames or stack text never reach a caller.

## Timeout and cancellation

- Default budget: `20_000 ms` (`DEFAULT_AI_TIMEOUT_MS`); caller overrides are capped
  at `120_000 ms` and rejected when non-positive.
- A caller `AbortSignal` maps to reason `cancelled`; the timeout maps to `timeout`.
  The first cause wins.
- Timers and listeners are removed in `finally`, so a completed run leaves nothing
  attached.
- Tests cover: pre-aborted signal, cancellation mid-flight, timeout with an adapter
  that ignores the signal, and an out-of-range timeout.

## Cost and safety interfaces

`AiUsage` carries provider-reported `inputTokens` / `outputTokens` / `totalTokens`.
`AiCostEstimator` takes explicit `AiPriceTable` entries supplied by a deployment
owner and returns integer micros of the provider's billing currency, or
`UNPRICED_ESTIMATE`. There are no price constants in the repository and no credits,
deductions, quotas or billing code.

Safety rules a future real adapter must satisfy:

1. Read credentials only from Worker secrets; never from the request, bundle or logs.
2. Abort promptly on `request.signal`; release sockets and timers.
3. Return only normalised fields; never forward a raw provider payload.
4. Report usage exactly as the provider states it, or omit it. Never estimate tokens.
5. Map provider-specific failures to `AI_PROVIDER_ERROR_CODES`; keep provider text in
   server logs only.
6. Enforce the supplied `maxOutputTokens` and temperature; do not extend limits.
7. Make no request when `isConfigured()` is false.
8. Be registered in `productionRegistry` only by a reviewed code change, never from
   configuration.
9. Require owner approval for any paid service, and document the data-retention terms.

## Adding a real adapter (future milestone)

1. Owner approval for the provider and its pricing/terms (D1, D2, D3).
2. Add the adapter under `apps/api/src/ai/adapters/<id>.ts`, implementing
   `AiProvider` and importing no Node networking.
3. Update the ESLint `ai-provider-boundary` rule to permit the reviewed client, and
   only that client.
4. Register it explicitly in `productionRegistry` in `registry.ts`.
5. Add offline tests using the fake for the pipeline, plus adapter tests with a
   stubbed transport. No live call in CI.
6. Confirm `/api/v1/ai/status` reports `ready` only when the adapter has a credential.
7. Wire `POST /api/v1/ai/run` in a separate reviewed milestone, behind auth and quota
   design (M2).

## How isolation is proven

- Tests assert `productionRegistry.list()` is empty, the production barrel exports no
  `FakeProvider`, and `POST /api/v1/ai/run` still returns 501 even with `AI_PROVIDER`
  set.
- A test asserts no provider SDK dependency is declared in `apps/api/package.json`.
- ESLint rules ban `fetch`, vendor SDK imports and Node networking inside
  `apps/api/src/ai/`, and ban importing test doubles from production modules.

## Still absent

No real adapter, no network call, no key, no migration, no wallet, no credits, no
payment code, no deployment, and no change to authentication. All eight AI tools
remain `planned` with `creditCost: null`.

## Decisions before M1B

- **D1 / D2**: provider and model per tool.
- **D3**: whether quotas exist, and their server-side enforcement design.
- **D15**: final input caps, output ceilings, temperatures and timeout budget.
- **D18 (new)**: where adapter client code lives and which HTTP/SDK boundary is
  allowed; the ESLint boundary rule must be updated with the decision.
- **D19 (new)**: owner-supplied price table format and where it is deployed.
