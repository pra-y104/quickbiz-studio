# Design system and visual standard

This document is a requirement, not a suggestion. Every screen is reviewed against
it before it is called finished.

## Direction

QuickBiz Studio should look like a serious international SaaS product: calm,
precise and expensive in feel. Midnight navy foundations, a refined violet primary,
a restrained electric-blue accent, and quiet neutral surfaces.

Rejected on purpose: random accent colours, heavy gradients, glassmorphism, huge
hero text with no message, decorative animations, icon soup, and any layout that
only works on a desktop.

## Colour

Tokens live in `apps/web/src/styles/tokens.css` and are exposed to Tailwind in
`apps/web/src/styles/globals.css`.

- **Brand violet** `brand-500` / `brand-600` - primary actions, active states,
  selected navigation. Never used for body text.
- **Electric blue** `electric-*` - a single accent per screen at most.
- **Navy neutrals** `navy-*` - dark surfaces and text on light surfaces.
- **Semantic tokens** - `canvas`, `surface`, `surface-muted`, `elevated`, `border`,
  `border-strong`, `ink`, `ink-muted`, `ink-subtle`, `success`, `warning`, `danger`,
  `accent`, `focus`.

Rules:

1. Components use semantic tokens, never raw hex values.
2. Both light and dark themes must be reviewed. The switch lives in the header.
3. Text contrast targets WCAG AA (4.5:1 body, 3:1 large text and UI borders).
4. Status colour carries meaning only: green = success, amber = caution, red = failure.
5. One primary button per view. Everything else is secondary, outline or ghost.

## Typography

One neutral sans-serif family, tight display tracking, generous body line height.

| Role | Size | Weight |
|---|---|---|
| Display | 36-60 px, responsive | 600 |
| Page title | 24-30 px | 600 |
| Section title | 18-20 px | 600 |
| Card title | 16 px | 600 |
| Body | 14-16 px | 400 |
| Caption / meta | 12 px | 400-500 |

Never below 12 px. Inputs use at least 16 px on mobile to prevent iOS zoom.

## Spacing and layout

- Base unit 4 px. Common steps: 4, 8, 12, 16, 20, 24, 32, 40, 56, 80.
- Page container: `max-w-6xl`, horizontal padding 16 px mobile / 24 px tablet / 32 px desktop.
- Card radius 16 px (`rounded-card`), control radius 8 px, pills 999 px.
- Elevation is subtle: one hairline border plus a soft shadow. No heavy drop shadows.
- Breakpoints: 360 px (small Android) → 640 → 768 → 1024 → 1280.

## Brand presentation

- The wordmark is **temporary but consistent**: a violet-to-electric rounded tile with a
  geometric "Q" aperture, plus a two-part wordmark (primary word in ink, suffix in muted
  ink or lighter weight).
- All brand strings come from `BRAND` in `packages/shared/src/constants/brand.ts`.
  Renaming the product means editing that one file, replacing the favicon and rebuilding.
- The name is not permanently approved. No component may hard-code it, and no legal
  document may assume it before the owner signs off.

## Dark band convention

The hero and the closing call to action use a fixed `navy-950` surface in both themes.
This is the only place where a component deliberately ignores the active theme, and it
is allowed because:

1. It frames the product preview as a single, memorable moment.
2. Text on it uses fixed `white/…` opacities, not semantic ink tokens.
3. The aura (`.qb-aura`) and grid (`.qb-grid`) layers are decorative, hidden from
   assistive technology, and never used elsewhere in the page.

## Components

Primitives live in `apps/web/src/components/ui/`:

`button`, `card`, `badge`, `input`, `textarea`, `label`, `field`, `alert`,
`spinner`, `skeleton`, `container`, `theme-toggle`.

Rules:

1. New UI primitives go here, not inside pages.
2. Every interactive element has a visible focus ring and works from a keyboard.
3. Icon-only buttons need an `aria-label`.
4. Disabled and loading states are part of the component, not an afterthought.
5. A component that needs a new token adds it to `tokens.css` first.

## Required states for every async surface

- **Loading** - skeleton or spinner with the surrounding layout intact.
- **Empty** - explains what will appear and the next useful action.
- **Error** - plain-language message, retry where realistic, request id available.
- **Success** - the result is obvious and copyable or downloadable.

## Interaction and motion

- Transitions 120-200 ms, colour and shadow only. No bouncing, no parallax.
- Respect `prefers-reduced-motion` (handled globally).
- Show the credit cost before any paid action, and confirm before spending.
- Never leave a button looking active while a request is in flight.

## Mobile-first review checklist

1. 360 px width with no horizontal scroll.
2. Tap targets at least 44 px.
3. Thumb-reachable primary actions.
4. Forms usable with the Android keyboard open.
5. Long results scroll inside their own area, not the whole page.
6. Nothing important hidden behind hover.

## Review procedure

For each screen: screenshot light and dark on phone and desktop, then check
hierarchy, type, colour, spacing, responsiveness, accessibility, states and copy.
If a screen looks generic, it is not finished.

## Brand mark

The QuickBiz mark is a white bolt on a violet-to-blue tile, with the wordmark set as
`QuickBiz` (semibold) and `Studio` (regular, muted) on one baseline.

- Geometry lives in `apps/web/src/components/brand/logo.tsx` and is mirrored by
  `apps/web/public/favicon.svg`.
- Home-screen icons are generated from the same geometry by
  `node scripts/generate-brand-icons.mjs`; do not hand-edit the PNGs.
- The tile uses the brand gradient so the mark stays recognisable in both themes,
  and the bolt has no thin details so it survives 16 px rendering.
- Rejected direction: any circular mark with a handle, which reads as a magnifying
  glass rather than a brand.
