# Stage 6 M1B: QuickBiz Creative Studio

Creative Studio is an in-product design editor. Customers create, edit, save and
export professional designs without leaving QuickBiz Studio and without a
third-party design tool.

This milestone is delivered as C0–C8. C0–C6 are implemented in this branch.
C7 and C8 are prepared and disabled.

## What exists

| Capability | Location | State |
|---|---|---|
| Versioned document model and validation | `packages/shared/src/creative/document.ts` | Implemented |
| Canvas presets (print mm + DPI, digital px) | `packages/shared/src/creative/presets.ts` | Implemented |
| 24 original templates | `packages/shared/src/creative/templates.ts` | Implemented |
| Portable `.qbdesign` envelope | `packages/shared/src/creative/project-file.ts` | Implemented |
| Offline text metrics for layout | `packages/shared/src/creative/text-metrics.ts` | Implemented |
| Geometry, commands, history | `apps/web/src/lib/creative/engine/` | Implemented |
| Canvas renderer (editor, project thumbnails, export) | `apps/web/src/lib/creative/render/` | Implemented |
| Interactive stage (select, move, resize, rotate, zoom) | `apps/web/src/components/creative/canvas-stage.tsx` | Implemented |
| Layers and properties panels | `apps/web/src/components/creative/` | Implemented |
| Upload ingest and asset store | `apps/web/src/lib/creative/assets/`, `storage/` | Implemented |
| Local autosave (IndexedDB) | `apps/web/src/lib/creative/editor/use-studio-editor.ts` | Implemented |
| Export PNG / JPG / PDF | `apps/web/src/lib/creative/export/` | Implemented |
| AI text assistance | `apps/web/src/lib/creative/ai/text-assist.ts` | Prepared, disabled |
| AI image generation | `apps/web/src/lib/creative/ai/image-provider.ts` | Prepared, disabled |

## Architecture rules

1. **The engine has no AI dependency.** Nothing under `packages/shared/src/creative/`
   or `apps/web/src/lib/creative/{engine,render,export,storage}` imports the AI
   modules. Editing, saving and exporting work with every AI feature disabled.
2. **The document is data, not markup.** There is no HTML, URL or script field. A
   document cannot make the application fetch or execute anything.
3. **Assets are ids.** Images are referenced by `assetId` and stored as bytes on the
   device. The server never fetches a customer-supplied URL.
4. **The renderer is shared.** The editor, saved-project thumbnails and every export
   call `renderDocument`, so what the customer sees is what is exported. Template
   *cards* use a stylised miniature rather than a full render, and say so in code.
5. **Commands are pure.** Every edit is `(document) => document`, which is why undo
   is a restore rather than an inverse patch, and why every command is testable
   without a browser.

## Data and storage

Phase 1 is local-only, by design:

- projects and assets live in IndexedDB (`quickbiz-creative`),
- the interface states that clearing site data removes designs,
- `.qbdesign` export exists so work can be moved between devices.

Phase 2 (server persistence) is **not** implemented and requires separate
approval. It would add a migration, a private storage bucket, owner-based RLS and a
retention policy. Until then, a design is never described as synced.

## Security posture

| Threat | Control | Where |
|---|---|---|
| Malformed or hostile project file | Strict Zod validation, size cap, explicit version rejection | `shared/creative/document.ts`, `project-file.ts` |
| Image upload abuse | Magic-byte sniffing, 10 MB and 24 MP ceilings, decode-and-re-encode, no SVG | `assets/ingest.ts` |
| EXIF / GPS leakage | Re-encode through a canvas; original bytes never kept | `assets/ingest.ts` |
| Remote content injection | No URL fields in the document; server never fetches | document schema |
| Cross-tenant access | Not applicable in Phase 1 (no server records) | — |
| Secret exposure | No key, token or provider call in this workstream | bundle scan |
| Internal detail leakage | Failures surface short, fixed messages | `export/`, `assets/` |
| Runaway memory | Node ceiling (150), export size guard (40 MP), dpr cap of 2 | engine, export |

**Residual risks**

- Local-only storage can be cleared by the browser or by the user. This is stated
  in the interface, not hidden.
- PDF export is image-based: text is not selectable and files are larger than
  vector PDFs. Stated in the export dialog.
- Very large designs on low-end devices may render slowly. Mitigated by the node
  ceiling, a capped backing-store resolution and coalesced history, but not
  eliminated.

## What is deliberately absent

- No paid service, subscription, font purchase, stock asset or template pack.
- No new runtime dependency. The editor is built on the canvas API already
  available in the browser.
- No database migration, Supabase Storage bucket or authentication change.
- No wallet, credit, price or payment change.
- No AI provider registration, key, request or paid call.
- No deployment.

## C7 — AI text assistance

Status: **prepared, disabled.**

`CREATIVE_STUDIO_FLAGS.aiText` is `false`. `requestSuggestions()` returns a typed
`disabled` result and never touches the network. The interface opens an
explanation instead of pretending.

Depends on, and must not start before:

1. Stage 6 M1B provider work merged, reviewed and approved (D1, D2).
2. Quota and pricing decisions (D3, D15) signed off.
3. A server-side rate limit that is not per-isolate (Stage 9 blocker).
4. `POST /api/v1/ai/run` wired behind auth with `describeAiFailure` mapping.

When approved, the only editor-side change is the body of `requestSuggestions`.

## C8 — AI image generation

Status: **prepared, disabled.**

`CREATIVE_STUDIO_FLAGS.aiImage` is `false` by default (the flag the task brief called
`AI_IMAGE_ENABLED`; there is no environment variable of that name). `productionImageRegistry` is empty,
module-local and frozen; it exposes no `register` method. No image module imports
the design engine and the engine imports no image module.

Before any image provider is enabled:

1. Owner approval for the provider, its terms and its data-retention policy.
2. A funded budget with a hard per-user and per-day image cap.
3. The same adapter rules M1A set for text: keys only as Worker secrets, abort
   support, normalised output, fixed error messages, no raw payload.
4. Content-safety handling for generated and uploaded imagery.
5. A decision on AI editing of customer photos, which is out of scope here.

Image generation is not free at production quality. Free preview credits are not a
production allowance and are not assumed.

## Acceptance criteria

C0–C6 acceptance is met when:

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass.
- `pnpm test` passes, including the shared, API and web suites.
- `pnpm build:web` and `pnpm build:api` succeed.
- A design can be created, edited, saved, reopened, exported and re-imported.
- The editor remains fully usable with both AI flags off.
- No network call, secret, migration, deployment or dependency is introduced.

## Verification notes

- Renderer, geometry and export are exercised through unit tests with no browser.
- The PDF writer is asserted byte-for-byte at the object offsets.
- Upload validation is tested against HTML and SVG payloads disguised as images.
## Remediation record (post-review)

Four high-severity review findings were fixed on this branch.

| ID | Finding | Fix |
|---|---|---|
| H1 | A write could be reported as saved before its IndexedDB transaction committed | `runRequest` resolves `readwrite` transactions on `oncomplete`; aborts, quota errors and version changes reject. Covered by `storage/__tests__/idb.test.ts`. |
| H2 | A zoomed canvas could not be panned and its start edges were unreachable | The stage now uses a clamped pan transform, pointer panning (middle button, space-drag, two-finger drag) and pinch zoom with the gesture centre anchored. Wheel zoom/pan is attached natively with `{ passive: false }`. |
| H3 | Layer hide/lock/delete acted on the selection, not the clicked row | Layer actions take a node id; `toggleLocked(id)`, `toggleHidden(id)` and `deleteNodes([id])`. |
| H4 | A cached project switch could render the previous design and autosave it over the new project | The studio route keys the editor by project id, and `useStudioEditor` also resets when `initial.id` changes. Covered by `editor/__tests__/use-studio-editor.test.tsx`. |

Also resolved: document-pixel conversion for placement and alignment (M1), rotation-handle
geometry parity (M2), a schema-enforced group depth limit with guarded import parsing (M3),
non-destructive import (M4), touch navigation (M5), compact wrapping mobile controls (M6),
pure state updaters (M7), shortcuts suppressed while a dialog is open (M8), header-based
dimension checks before decode (M9), and the low-severity items (asset garbage collection,
locked-layer protection, id fallback, rename consistency, coordinate bounds, an ESLint
network boundary for Creative Studio modules, genuine project thumbnails).

### Content Security Policy (L10) — proposal only, not applied

The web app is served by Cloudflare Pages and currently sends **no CSP**. Changing
production headers is outside this remediation, so the proposal is recorded here for
separate approval.

Proposed `apps/web` `_headers` policy for `/*`:

```
Content-Security-Policy:
  default-src 'self';
  base-uri 'none';
  object-src 'none';
  frame-ancestors 'none';
  img-src 'self' data: blob:;
  font-src 'self';
  style-src 'self' 'unsafe-inline';
  script-src 'self';
  connect-src 'self' https://<project>.supabase.co;
  form-action 'self';
  upgrade-insecure-requests
```

Compatibility notes:

- **Blob downloads.** Exports are produced locally and downloaded through an object URL
  created by `URL.createObjectURL`. Downloads are navigation to a `blob:` URL rather than a
  sub-resource fetch, so `default-src` does not need `blob:`; adding `blob:` to `default-src`
  is nevertheless recommended if a future browser enforces otherwise.
- **Images.** Uploaded images and thumbnails are `blob:` or `data:` URLs, hence `img-src`.
- **Styles.** Tailwind v4 injects a style element at runtime, so `'unsafe-inline'` is
  required for styles. A hash/nonce based policy would need a build change and is future work.
- **Scripts.** No inline script is used except the theme bootstrap in `index.html`, which
  must be moved to an external file (or hashed) before `script-src 'self'` can be enforced
  without `unsafe-inline`. That migration is itself a separate, reviewable change.
- **Supabase.** `connect-src` must list the project's Supabase origin for auth requests.

Until this is approved and tested, the absence of a CSP remains a known production
hardening gap, not a regression introduced here.
