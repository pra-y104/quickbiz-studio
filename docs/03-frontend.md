# Frontend development

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query,
React Hook Form + Zod, Radix UI primitives, lucide icons.

## Folder structure

```
apps/web/src/
  app/          router, providers, app entry wiring
  components/
    brand/      logo and brand marks
    layout/     app shell, utility shell, header, mobile menu, footer
    marketing/  hero, tool showcase, section heading, cards, sections/
    auth/       auth shell, password field/strength, config notice, route guards
    account/    signed-in chrome
    tools/      catalogue icon mapping, tool chrome, result panels, document editor
    ui/         design-system primitives
  content/      typed page copy (homepage.ts, auth.ts, tools.ts)
  i18n/         i18next setup and locale catalogues
  lib/          api client, env, query client, auth gateway/provider, helpers
    tools/      PDF writer, document layout, download helpers
  pages/        route-level screens (auth/, tools/, dashboard, profile, setup)
  styles/       tokens.css, globals.css
```

## Adding a page

1. Create `src/pages/my-page.tsx` exporting a named component.
2. Register it in `src/app/router.tsx` with a lazy import and the app shell.
3. Add copy to `src/i18n/locales/en.json`, not inline strings, unless the text is
   internal tooling.
4. Design all four async states before you consider the page done.

## Page copy

Long marketing prose lives in `src/content/` as typed objects so section shapes are
checked by the compiler. Short interface labels stay in `src/i18n/locales/en.json`.
See `docs/15-stage-3-homepage.md` for the homepage content model.

## Data fetching

- One `QueryClient` for the app (`src/lib/query-client.ts`): 30 s stale time, one
  retry, no refetch on window focus.
- Wrap server reads in `useQuery`, writes in `useMutation`.
- Every mutation shows a pending state, then a success or error state, and disables
  duplicate submits.
- API access goes through `src/lib/api-client.ts`. It unwraps `{ data }`, converts
  every failure into `ApiRequestError` with a stable `code`, and attaches the auth
  token when Stage 4 arrives.

```ts
const { data, isPending, error } = useQuery({
  queryKey: ['tools'],
  queryFn: ({ signal }) => api.get<ToolsResponse>('/api/v1/tools', { signal }),
});
```

## Forms

- `useForm` + `zodResolver` with a schema from `@quickbiz/shared` where one exists.
- Server responses are the final authority; client validation is a courtesy.
- `Field` renders label, hint and error. Errors use `role="alert"` and are linked
  with `aria-describedby`.
- Disable the submit button while `formState.isSubmitting` is true.

## Accessibility conventions

- One `h1` per page, headings in order.
- Landmarks: `header`, `main#main`, `footer`; a skip link is in the shell.
- Focus visible on every interactive element (tokens provide the ring colour).
- Icon-only controls carry `aria-label`; decorative icons are `aria-hidden`.
- Live regions for async results (`role="status"` or `aria-live="polite"`).
- Colour is never the only signal for an error.

## Performance rules

- Route-level code splitting is already enabled in the router.
- Keep the initial bundle lean; import icons individually.
- Avoid layout shift: reserve space for images, skeletons and results.
- Test on a throttled connection before Stage 9 sign-off.

Stage 4 split the Supabase client into its own chunk, so the initial vendor chunk is
now ~483 kB raw / ~139 kB gzipped. Route chunks stay small (auth screens 5-7 kB each)
and the mobile drawer loads lazily. Further preload tuning is scheduled for Stage 9.

## Environment

Only `VITE_*` variables reach the browser (`src/lib/env.ts` validates them). Never
put a service key, AI key or payment secret in a `VITE_` variable.
