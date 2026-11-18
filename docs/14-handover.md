# Handover and ownership

## Requirements for a new developer

- Node.js 20.19+ (24 recommended)
- pnpm 12 (`corepack enable` then `corepack prepare pnpm@12.14.0 --activate`)
- Git
- Optional: Cloudflare and Supabase accounts for deployment

A phone-only owner is supported by doing everything through GitHub, the Cloudflare
dashboard, the Supabase dashboard and Kilo Code. No local terminal is required.

## Clone and run

```bash
git clone https://github.com/pra-y104/quickbiz-studio.git
cd quickbiz-studio
pnpm install
pnpm dev:api     # terminal 1 - http://localhost:8787
pnpm dev:web     # terminal 2 - http://localhost:5173
```

On a phone, open the preview URL produced by a pull request instead of running a
local server.

## Verify before pushing

```bash
pnpm verify
```

This runs typecheck, lint, tests, web build and the worker bundle validation.

## Where things live

| Concern | Location |
|---|---|
| Routes | `apps/web/src/app/router.tsx` |
| Design tokens | `apps/web/src/styles/tokens.css` |
| UI primitives | `apps/web/src/components/ui/` |
| API endpoints | `apps/api/src/routes/` |
| Error codes | `packages/shared/src/types/api.ts` |
| Tool catalogue | `packages/shared/src/catalog/tools.ts` |
| Database migrations | `supabase/migrations/` |
| Decisions and rules | `docs/` |

## Maintenance rhythm

1. One stage at a time, on a branch, reviewed as a pull request.
2. Update the relevant doc in the same change as the code.
3. Add tests with the feature, not after it.
4. Record any new environment variable in `.env.example` and
   `docs/12-environment-variables.md`.
5. Record owner decisions (credit price, free allowance, provider choice) in the
   roadmap before implementation.

## Portability and no lock-in

- Standard React + Node-style TypeScript. No proprietary framework.
- Database access is plain SQL through Supabase, which is managed PostgreSQL. A move
  to another Postgres host means changing connection details and auth provider only.
- The API is Hono: the same handlers run on Node, Bun or Deno if the free Workers
  tier ever stops fitting.
- Static frontend can be hosted on any CDN.
- Everything needed to rebuild is in the repository: code, migrations, docs.

## Transferring the project

1. The repository is owned by the owner's GitHub account; a new developer is added as
   a collaborator rather than given ownership.
2. Export the code with **Code → Download ZIP**, or `git clone`.
3. Transfer Cloudflare and Supabase projects by inviting the new developer to each
   dashboard, then rotating every secret afterwards.
4. Rotate `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY` and any payment keys after any
   handover or suspected exposure.

## Known gaps carried forward

- Vendor chunk size (~160 kB gzipped) needs the Stage 9 performance pass.
- Rate limiting is per isolate until Stage 9.
- No frontend CSP yet.
- No automated dependency audit yet.
- Payment onboarding prerequisites (registered business, settlement account) are
  unverified and must be confirmed before Stage 8.
