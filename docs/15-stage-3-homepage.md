# Stage 3 - Homepage, brand presentation and visual experience

Status: **implemented** (pre-launch marketing site).

## What this stage delivered

A complete marketing homepage, responsive navigation, footer, a temporary but
distinctive wordmark, and a reusable set of marketing components built on the Stage 2
design system.

Nothing here is a live product feature. AI generation, accounts and payments remain
unbuilt, and the page says so in three places: the announcement bar, the per-section
notes, and the closing call to action.

## Page structure

| Order | Section | Anchor | Component |
|---|---|---|---|
| 1 | Hero + interface preview | - | `components/marketing/hero.tsx`, `hero-preview.tsx` |
| 2 | AI tools showcase | `#ai-tools` | `components/marketing/tool-showcase.tsx` |
| 3 | Free tools showcase | `#free-tools` | `components/marketing/tool-showcase.tsx` |
| 4 | How it works | `#how-it-works` | `sections/how-it-works-section.tsx` |
| 5 | Pricing introduction | `#pricing` | `sections/pricing-section.tsx` |
| 6 | Customer promise | `#promise` | `sections/promise-section.tsx` |
| 7 | Trust and transparency | `#trust` | `sections/trust-section.tsx` |
| 8 | Questions | `#questions` | `sections/faq-section.tsx` |
| 9 | Closing call to action | - | `sections/final-cta-section.tsx` |

Navigation, announcement bar and mobile drawer live in `components/layout/site-header.tsx`
and `mobile-menu.tsx`. Footer: `components/layout/site-footer.tsx`.

## Content model

All long-form marketing copy lives in `apps/web/src/content/homepage.ts` as a typed
`HomepageContent` object.

Why not the translation JSON: the prose is long, structured (lists of plans, promises,
questions) and needs compile-time shape checking. A second locale supplies the same
object shape, so localisation does not require touching components. Short chrome labels
(navigation, theme toggle, skip link, 404) stay in `i18n/locales/en.json`.

Tool cards are generated from `packages/shared/src/catalog/tools.ts`, so the homepage
cannot advertise a tool the platform does not define, and adding a tool automatically
adds a card.

## Brand presentation and renaming

The wordmark is the `Logo` / `LogoMark` pair in `components/brand/logo.tsx`, driven by
`BRAND` in `packages/shared/src/constants/brand.ts`.

To rename the product later:

1. Edit `BRAND.name`, `BRAND.wordmark.primary`, `BRAND.wordmark.secondary`,
   `BRAND.tagline` and `BRAND.shortDescription`.
2. Keep `primary + " " + secondary` equal to `name`; a unit test asserts this.
3. Replace `apps/web/public/favicon.svg` and the `og:*` copy in `index.html`.
4. Rebuild. Header, footer, page titles and legal copy follow automatically.

No component hard-codes the product name. `APP_NAME` / `APP_TAGLINE` remain as aliases
so older imports keep working.

## Visual decisions

- **Hero**: a deep navy band in both themes, with a violet/blue aura, a faint 64 px
  grid and a product preview card. This is the one place where a fixed dark surface is
  deliberate; the rest of the page follows the active theme.
- **Card language**: 16 px radius, hairline border, soft elevation, small icon tiles.
  Hover raises elevation by one step and shifts the icon tile to solid brand colour.
- **Density**: one idea per section, 2xl-3xl headings, 16 px section padding on mobile
  and 20 px on desktop, consistent 24 px anchor offset under the sticky header.
- **Motion**: colour/shadow/transform transitions of 150-200 ms only. Global
  `prefers-reduced-motion` rules disable them.

## Responsiveness

| Width | Behaviour |
|---|---|
| 360-639 px | Single column, stacked hero, 1-up tool grid, drawer navigation |
| 640-1023 px | Two-column tool grid, inline header CTA appears, drawer navigation |
| 1024 px+ | Hero splits into copy + preview, full inline navigation, four-column tool grid, three-column pricing |

Long prose is capped at `max-w-2xl`-`max-w-3xl` so line length stays readable.

## Accessibility

- One `h1`, ordered `h2`/`h3` per section, and `aria-labelledby` on every section.
- Skip link to `#main`; visible focus rings on all interactive elements.
- The mobile drawer is a Radix dialog: focus trap, `Escape` to close, labelled
  title/description, and background scroll lock.
- Decorative icons and the aura/grid layers are hidden from assistive technology.
- State is never communicated by colour alone; every card carries a text label.
- FAQ uses native `<details>` so keyboard and screen-reader behaviour come for free.

## Performance

- Route-level code splitting, plus the mobile drawer is a separate lazy chunk warmed
  after 1.5 s idle. Initial bundle stays close to Stage 2 (~168 kB gzipped).
- No images, no web fonts and no animation libraries; the hero artwork is CSS.
- Icons are imported individually so only used glyphs are bundled.

## Honesty rules applied here

- The preview card is labelled "Interface preview with sample content. Not a live
  generation."
- AI and free tool sections state that they are in the build queue.
- Pricing shows no invented prices or package sizes; it explains the model and says
  prices are published before checkout opens.
- No customer logos, testimonials, ratings or user counts are shown, because none
  exist.
- No legal links are published before the documents exist; the footer says when they
  arrive.

## Tests added

`apps/web/src/pages/home.test.tsx`
- single `h1`, all section headings, 8 AI + 8 free tool cards, 8 promise items,
  5 question disclosures, honest-build copy, and no dead internal links.

`apps/web/src/components/layout/site-header.test.tsx`
- primary navigation, pre-launch notice, drawer open/close by link and by `Escape`,
  theme toggle updates `data-theme` and `aria-pressed`.

`packages/shared/src/__tests__/brand.test.ts`
- wordmark joins to the product name, public copy is non-empty, legacy aliases match.

## Extending this page

- **New section**: add copy to `HomepageContent`, build it under
  `components/marketing/sections/`, mount it in `pages/home.tsx`, then add the anchor to
  `HOMEPAGE_NAV` and to the footer if it belongs there.
- **New tool**: add it to the shared catalogue; it appears in the correct showcase
  automatically.
- **New locale**: copy `content/homepage.ts` to a locale-specific module with the same
  type, then select it by locale.

## Known limitations

- Individual tool routes, pricing tables and legal pages do not exist yet, so no link
  points at them.
- Prices, credit packs and the free allowance are still unapproved; the page avoids
  numbers until they are.
- No visual regression tooling yet; review is manual on a real phone (Stage 9 adds
  Playwright screenshots).
