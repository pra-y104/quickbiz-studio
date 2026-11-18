# QuickBiz Studio

**Powerful Tools. Fair Pricing. No Surprises.**

QuickBiz Studio is a premium platform for AI-assisted writing tools and everyday
digital utilities - calculators, converters, invoice and quotation makers - built for
users worldwide. Nigeria is the first payment market, not the boundary.

This repository is the complete, portable source of truth: application code, shared
contracts, database migrations, documentation and CI.

## Status

**Stage 5 - ordinary tools.** Eight free utilities are live at `/tools`: a calculator,
percentage calculator, unit converter, date calculator, invoice maker, quotation maker,
word and character counter, and a text formatter. They run entirely in the browser, need
no account and cost no credits. Invoices and quotations download as real PDFs generated
on the device.

Stage 4 authentication (registration, email verification, sign-in, password recovery,
profiles) remains in place. It stays disabled - and says so - until a Supabase project is
connected and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set. See
[docs/16-supabase-setup.md](./docs/16-supabase-setup.md).

Not built yet: AI provider calls, credits, wallet and payments.

Current verification: 262 automated tests passing, typecheck clean, lint clean, web
build and worker bundle both validated locally. Initial bundle ~140 kB gzipped, with each
tool, the document engine, auth and the mobile drawer split into their own lazy chunks.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query |
| UI | Custom components on Radix primitives, CSS design tokens |
| Forms | Controlled React state + shared Zod schemas |
| Auth | Supabase Auth (official client) + jose token verification in the API |
| API | Cloudflare Workers, Hono |
| Database | PostgreSQL (Supabase) |
| Shared | TypeScript types + Zod schemas in `packages/shared` |
| Monorepo | pnpm workspaces |
| CI | GitHub Actions |

## Repository structure

```
apps/web            React SPA (Cloudflare Pages target): pages, marketing sections, content
apps/api            Worker API (Cloudflare Workers target)
packages/shared     types, Zod schemas, tool catalogue, formatters
packages/config     shared tsconfig bases
supabase            migrations and database notes
docs                14 documents: architecture, design, security, roadmap, handover
.github/workflows   CI: typecheck, lint, format, tests, builds
```

## Quick start

```bash
corepack enable
pnpm install
pnpm dev:api     # http://localhost:8787
pnpm dev:web     # http://localhost:5173
```

Copy environment templates first:

```bash
cp .env.example .env
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Both real files are gitignored. No keys are required to run Stage 2.

## Scripts

| Command | Effect |
|---|---|
| `pnpm dev:web` | Vite dev server |
| `pnpm dev:api` | Wrangler dev server |
| `pnpm typecheck` | TypeScript across all workspaces |
| `pnpm lint` | ESLint flat config |
| `pnpm test` | All Vitest suites |
| `pnpm build` | Web build + worker bundle validation |
| `pnpm verify` | Typecheck, lint, test, build |
| `pnpm format` | Prettier |

## API surface (current)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | liveness, version, environment |
| GET | `/api/v1/meta` | public platform metadata |
| GET | `/api/v1/tools` | read-only tool catalogue (`kind`, `category`, `status`, `q`) |

Every response uses `{ data, requestId }` or `{ error: { code, message, requestId } }`.

## Documentation

Start with [docs/README.md](./docs/README.md). The most useful entries:

- [Architecture](./docs/01-architecture.md)
- [Design system](./docs/02-design-system.md)
- [Stage 3 homepage](./docs/15-stage-3-homepage.md)
- [Supabase setup](./docs/16-supabase-setup.md)
- [Database strategy](./docs/05-database.md)
- [Security](./docs/08-security.md)
- [Roadmap](./docs/13-roadmap.md)
- [Handover](./docs/14-handover.md)

## Security rules for contributors

- Never commit keys, tokens, passwords or `.dev.vars`.
- Never accept a credit balance, price or user id from the browser.
- Never present fixed text as AI output.
- Every new table enables RLS in the same migration.
- Every new endpoint validates input with a shared Zod schema.

## Limitations of the free plan

Free tiers are not permanent. Known limits: Workers daily request ceiling and CPU
time, Supabase free project pausing and storage caps, rate-limited built-in email,
and CI minutes on private repositories. A domain name is the only certain early cost.
Details in [docs/11-deployment.md](./docs/11-deployment.md).

## Licence and ownership

Private project. Source code is owned by the repository owner and can be exported,
transferred or redeployed with another provider; see
[docs/14-handover.md](./docs/14-handover.md).
