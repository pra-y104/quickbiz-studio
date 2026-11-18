# Deployment

Nothing in this document has been deployed yet. Stage 2 validates builds locally only.
Deployment happens at Stage 9, with the owner's approval.

## Target topology

| Part | Service | Free-tier notes |
|---|---|---|
| Web app | Cloudflare Pages | Static hosting, commercial use allowed on the free plan, unlimited requests in practice |
| API | Cloudflare Workers | ~100k requests/day on free, always on, CPU-time limits apply per request |
| Database + Auth | Supabase | Small free database, pausing after inactivity, rate-limited built-in email |
| Source | GitHub | Public or private repository, Actions minutes capped on private repos |
| Domain | Registrar of the owner's choice | Not free - the only certain early cost |

Verify current limits on each provider's pricing page before launch. Free tiers change.

## Build outputs

- `apps/web/dist` - static files for Pages.
- `apps/api/dist` - worker bundle produced by a dry-run build (validation only).

## Steps (Stage 9)

1. **Cloudflare Pages**: connect the GitHub repository, set the root directory to
   `apps/web`, build command `pnpm build:web`, output directory `dist`.
2. **Worker**: create the worker, set secrets with `wrangler secret put`, and set
   `ALLOWED_ORIGINS` to the real frontend origin.
3. **Database**: create the production Supabase project, apply migrations in order,
   store the service-role key as a Worker secret only.
4. **Preview**: verify every flow on a preview URL from an Android phone before
   promoting to production.
5. **Custom domain**: attach the domain to Pages and to the Worker route.
6. **Rollback**: Pages keeps previous deployments; Workers supports version rollback;
   database changes are additive-first so a code rollback does not corrupt data.

## What must never be deployed

- Real keys or `.dev.vars` contents.
- Placeholder payment flows that could create a real charge.
- Any statement of "deployed" that has not been verified with a live request.

## Environment separation

Use a separate Supabase project for preview and production once payments exist.
Never test payment flows against production data.
