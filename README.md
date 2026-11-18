# QuickBiz Studio

**Powerful Tools. Fair Pricing. No Surprises.**

QuickBiz Studio is a premium platform for AI-assisted writing tools and everyday
digital utilities - calculators, converters, invoice and quotation makers - built for
users worldwide. Nigeria is the first payment market, not the boundary.

This repository is the complete, portable source of truth: application code, shared
contracts, database migrations, documentation and CI.

## Status

**Stage 2 - repository foundation.** The design system, API skeleton, shared
contracts, database conventions, CI and documentation are in place and tested.

Not built yet: authentication, tool implementations, AI provider calls, credits and
payments. Nothing in this build pretends those features exist.

Current verification: 41 automated tests passing, typecheck clean, lint clean, web
build and worker bundle both validated locally.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query |
| UI | Custom components on Radix primitives, CSS design tokens |
| Forms | React Hook Form + Zod |
| API | Cloudflare Workers, Hono |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Shared | TypeScript types + Zod schemas in `packages/shared` |
| Monorepo | pnpm workspaces |
| CI | GitHub Actions |

## Repository structure

```
apps/web            React SPA (Cloudflare Pages target)
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
