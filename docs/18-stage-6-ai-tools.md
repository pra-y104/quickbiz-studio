# Stage 6: AI tools

Stage 6 adds the eight AI tools to the API and the interface. It is delivered in
milestones so the contracts are proven before anything can spend money or reach a
network.

This document covers **M0 (contracts and guardrails)**, which is implemented. Later
milestones are described at the end so the boundary is explicit.

## M0 scope

M0 is offline by design. It defines what an AI tool accepts, what it must return, how
a prompt is versioned, which failure reasons exist, and how the API reports whether AI
is available. It adds no provider adapter, no secret, no network call and no charge.

Delivered:

| Piece | Location |
|---|---|
| Tool slugs, limits, prompt versions, schema registry | `packages/shared/src/ai/contracts.ts` |
| Input and output schemas for all eight tools | `packages/shared/src/ai/schemas.ts` |
| Closed option sets (tone, platform, section, ...) | `packages/shared/src/ai/options.ts` |
| Language list and RTL flag | `packages/shared/src/ai/languages.ts` |
| Error reasons, run statuses, availability reasons | `packages/shared/src/ai/errors.ts` |
| Prompt template shape and escaping helpers | `apps/api/src/ai/prompts/types.ts` |
| One versioned prompt per tool | `apps/api/src/ai/prompts/<tool>.ts` |
| Prompt registry | `apps/api/src/ai/prompts/index.ts` |
| `GET /api/v1/ai/status` | `apps/api/src/routes/ai.ts` |
| Provider/model preference in config | `apps/api/src/config/env.ts` |

## Shared contracts

The schemas are the single source of truth. The web form, the API validation and the
prompt serialiser all use the same definition, so a tool cannot accept one shape and
return another.

Rules applied to every tool:

1. **Inputs are strict.** An unknown key is rejected. A form that posts an extra field
   is a bug, not something to ignore silently.
2. **Outputs are strict about required fields, lenient about extras.** Extra keys are
   stripped; a missing required field is `invalid-response`.
3. **Every string is trimmed and length-capped** so an oversized paste is rejected
   before it could become a paid request.
4. **Enums are closed.** A typo cannot quietly become a different instruction.
5. **Cross-field rules live in the schema.** For example, a product price and its
   currency must be provided together.

`AI_TOOL_LIMITS` carries a provisional input cap, output-token ceiling and temperature
per tool. These numbers are placeholders until the owner approves final values
(decision D15).

## Prompt templates

A template is data plus one pure function:

```ts
interface PromptTemplate {
  tool: AiToolSlug;
  version: string;          // must equal AI_PROMPT_VERSIONS[tool]
  system: string;           // immutable; never contains user text
  outputContract: string;   // the JSON shape the model must return
  buildUser(input: unknown): string;
}
```

- `system` sets role, safety rules and the JSON requirement. It is checked by a test
  that it never contains a caller's text.
- `buildUser` re-parses the input with the tool schema, so a prompt can only be built
  from validated data.
- User content is serialised as JSON and wrapped in `<user_input>` markers. Angle
  brackets inside the payload are escaped to `\u003c` / `\u003e`, so pasted text such
  as `</user_input>` cannot close the block early. A test asserts exactly one closing
  marker survives.
- Prompt versions are owned by `packages/shared/src/ai/contracts.ts`, not by the
  prompt file, so the version recorded on a run cannot drift from the wording.

The eight versions in M0 are `writer-v1`, `advert-v1`, `translator-v1`,
`improver-v1`, `product-description-v1`, `business-name-v1`, `social-caption-v1` and
`business-plan-v1`.

## Availability status

```
GET /api/v1/ai/status
```

```json
{
  "configured": false,
  "reason": "no-adapters-registered",
  "requestedProvider": null,
  "model": null,
  "quota": null,
  "tools": [
    {
      "slug": "ai-writer",
      "status": "planned",
      "creditCost": null,
      "promptVersion": "writer-v1"
    }
  ],
  "total": 8
}
```

Decisions that this response encodes:

- **Availability is adapter-driven, not env-driven.** It is derived from the provider
  registry. Setting `AI_PROVIDER` names a preference; it does not make AI work. This
  build registers no adapter, so the reason stays `no-adapters-registered`.
- **`quota` is always `null`.** No server-side allowance exists yet, so the API does
  not claim that one is enforced. The design lands in M2.
- **Tool rows come from the catalogue.** `status` and `creditCost` mirror
  `TOOL_CATALOGUE`; all eight AI tools remain `planned` with `creditCost: null`.
- **`POST /api/v1/ai/run` returns 501.** It exists so the absence is explicit and
  testable: there is no code path in this build that can call a provider.

## Configuration

`apps/api/src/config/env.ts` reads two optional preferences:

| Variable | Behaviour |
|---|---|
| `AI_PROVIDER` | lowercase identifier; empty means unset |
| `AI_MODEL` | model id; empty means unset |

Both are validated once per isolate. Neither activates anything. `AI_API_KEY` is
declared but unused: no adapter reads it. Keys and quota numbers are deliberately not
part of the public status response.

## Test coverage

Offline only, no network:

- `packages/shared/src/__tests__/ai-contracts.test.ts` — slug parity with the
  catalogue, limits and schemas present, valid input accepted for every tool, unknown
  keys / bad enums / oversized fields / unpaired currency rejected, output required
  fields enforced, extras stripped, vocabularies narrow correctly, all eight tools
  still `planned` and unpriced.
- `apps/api/src/__tests__/ai-prompts.test.ts` — registry parity, version match,
  system never contains user text, delimiters closed exactly once, invalid input
  throws.
- `apps/api/src/__tests__/ai-status.test.ts` — unavailable by default, still
  unavailable when a provider is named, empty values treated as unset, all eight tools
  listed as planned and unpriced, `POST /ai/run` returns 501.

## Deliberately absent in M0

- No provider adapter, SDK or HTTP client for an AI vendor.
- No API key, secret or quota variable in use.
- No database migration and no `ai_runs` table.
- No credit display, deduction or reversal. Those belong to Stage 7 (decision D6).
- No streaming (D8) and no provider activation (D12).
- No fabricated output path: nothing in this build can produce text presented as AI.

## Decisions still open for later milestones

| ID | Decision |
|---|---|
| D1 | Provider selection (deferred; no adapter chosen) |
| D2 | Model per tool |
| D3 | Quota numbers and their server-side enforcement |
| D4 | Whether verified email is required to run AI tools |
| D5 | Usage persistence shape and retention |
| D9 | Data retention for prompts and results |
| D10 | Business-name legal and trademark disclaimer wording |
| D11 | Email-verification mechanism for AI runs |
| D13 | Who applies any migration to the owner's project |
| D15 | Final input caps, token ceilings and temperatures |
| D16 | Free-preview wording if any tool is offered before payment |
| D17 | Whether `ai_runs` ships at all |

M1 must not start until the owner approves a provider plan and the enforcement design
in D3.
