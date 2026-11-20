# Third-party licences — Creative Studio

Every dependency and asset used by Creative Studio is recorded here with its
licence and why it is acceptable for commercial use.

## Runtime dependencies added

**None.**

Creative Studio adds no npm dependency. The editor is built on the browser's
Canvas 2D API, Pointer Events, IndexedDB and `canvas.toBlob`, all of which are
platform features rather than third-party code.

## Editor engine decision

Fabric.js v6 (MIT) was evaluated and **not installed**.

| Option | Licence | Decision |
|---|---|---|
| Fabric.js v6 | MIT | Not installed in this milestone. It remains the preferred engine if a future milestone approves adding a dependency. |
| Konva / react-konva | MIT | Not used. |
| tldraw | tldraw licence; commercial use requires a paid licence | Rejected: paid terms. |
| Polotno | Commercial | Rejected: paid. |
| GrapesJS | BSD-3-Clause | Rejected: wrong interaction model. |

Because no editor SDK is installed, the MIT verification obligation is recorded but
not yet binding. If Fabric.js is adopted later, this file must record the exact
version and a copy of its licence.

## Fonts

Creative Studio ships **no font files**. Text is rendered with the device's system
font stacks (`ui-sans-serif`, Georgia, `Trebuchet MS`, `ui-monospace` and similar),
so nothing is redistributed and no font licence is triggered.

The intended OFL families (Inter, Plus Jakarta Sans, Lora, Playfair Display, DM
Sans) are listed in `FONT_FAMILIES` as `self-hosted` candidates with system
fallbacks. Adding the actual font binaries requires a separate approval and a
licence file per family.

## Icons

`lucide-react` (ISC) — already a project dependency, used for interface icons only.

## Templates and artwork

All 24 templates are original compositions built from geometry and typography in
`packages/shared/src/creative/templates.ts`. No stock photography, template pack,
brand artwork or third-party illustration is included.

## Export

PDF export is produced by the project's own writer
(`apps/web/src/lib/creative/export/creative-pdf.ts`) using the JPEG encoder built
into the browser. No PDF library is bundled.

## Review checklist for future additions

Before adding any package or asset:

1. Record name, exact version, licence and purpose in this file.
2. Confirm the licence permits commercial use and redistribution.
3. Confirm the package is maintained and has no known high-severity advisory.
4. Confirm it is not a paid SDK with per-seat or per-call fees.