# Authentication and user accounts (Stage 4)

Status: **implemented**, pending a real Supabase project. No account can be created in
a build without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the screens say so and
keep their forms disabled rather than simulating success.

## Provider

- Supabase Auth is the identity provider, used through `@supabase/supabase-js`.
- The browser only ever receives the **public** project URL and **anon** key. The
  service-role key is a server secret and is not referenced by the web app.
- `apps/web/src/lib/auth/gateway.ts` selects one of two implementations:

| Implementation | When | Behaviour |
|---|---|---|
| `SupabaseAuthGateway` | both public variables present | real sign-up, sign-in, reset, profile reads/writes |
| `UnconfiguredAuthGateway` | either variable missing | every operation rejects with `not_configured`; no session is invented |

`AuthGateway` (in `lib/auth/types.ts`) is the seam used by tests. Screens never call
Supabase directly, so they can be tested against an in-memory gateway.

## Flows

| Flow | Route | Behaviour |
|---|---|---|
| Register | `/register` | Email, password, confirmation, strength meter, terms checkbox. Success always reads "check your inbox", whether or not the address existed. |
| Verify email | `/auth/callback` | Supabase consumes the token; the page waits for the session and then continues. Expired or reused links show a recovery path. |
| Resend verification | `/verify-email` and inline on sign-in | Rate-limited by Supabase; the UI gives the same neutral confirmation. |
| Sign in | `/login` | Email + password, show/hide toggle, typed messages for invalid credentials and unconfirmed email. |
| Sign out | Account header | Clears the provider session and local state even if the network call fails. |
| Forgot password | `/forgot-password` | Always the same response, so the form cannot enumerate accounts. |
| Reset password | `/auth/reset-password` | Requires the short-lived recovery session; expired links get an explicit dead-end with a request-new-link action. |

### Password rules

Defined once in `packages/shared/src/schemas/auth.ts` and used by every form:

- 10 to 72 characters, at least one letter and one digit.
- Confirmation must match.
- Terms acknowledgement is a literal `true`.
- Strength guidance is advisory; the schema is the gate.

## Session handling

- `AuthProvider` starts in `loading`, restores the stored session asynchronously and
  subscribes to provider auth events. Protected routes wait for that state.
- Expired or revoked sessions arrive as a signed-out event; the next protected render
  redirects to sign-in with a `next` parameter.
- `signOut()` clears local state in a `finally` block, so a failed network call cannot
  leave the UI looking signed in.

## Protected routes

`RequireAuth` wraps `/dashboard` and `/profile`. While the session resolves it renders a
loading panel; signed-out visitors are redirected to
`/login?next=<current path>`.

`RedirectIfAuthenticated` wraps register, sign-in and forgot-password. Signed-in visitors
are sent to `next` when it is safe, otherwise `/dashboard`.

`lib/auth/redirect.ts` accepts only same-origin absolute paths and rejects
protocol-relative URLs, backslash tricks, control characters and scheme-prefixed paths.

## API authorisation

`apps/api/src/lib/auth-tokens.ts` verifies Supabase access tokens with `jose`:

| Mode | Selected by | Notes |
|---|---|---|
| JWKS (ES256/RS256) | `SUPABASE_JWKS_URL`, else derived from `SUPABASE_URL` | current Supabase signing keys |
| HS256 | `SUPABASE_JWT_SECRET` | legacy projects and local tests |

The middleware rejects missing, malformed, expired and wrongly audienced tokens with
401, and returns 503 when no verification configuration exists. Identity is taken only
from verified claims: `GET /api/v1/me` ignores any user id supplied by the caller.

## Database and Row Level Security

Migration: `supabase/migrations/0003_profiles.sql`.

- `public.profiles` holds `id`, `email`, `display_name`, `avatar_url`,
  `preferred_locale`, `created_at`, `updated_at`.
- RLS is enabled (not forced, so the owner-run signup trigger can insert the first row).
  Policies allow `select` and `update` only where
  `auth.uid() = id`; there is no client insert or delete policy.
- Column grants allow updates to `display_name`, `avatar_url` and `preferred_locale`
  only. `id`, `email` and timestamps are not writable by clients.
- A `security definer` trigger on `auth.users` creates the profile row at signup, so the
  browser never needs to insert its own identity row. Existing users are backfilled.
- `updated_at` is maintained by a trigger.

## Security decisions

1. **No user enumeration.** Registration and password recovery return identical copy for
   known and unknown addresses. Supabase's obfuscated-user response is detected as well.
2. **No privileged ids from input.** Profile writes use the session user id; the API
   derives identity from verified claims only.
3. **Safe redirects.** Every `next` value passes through `safeNextPath`.
4. **Public keys only.** The service-role key is absent from `apps/web`, and an anon key
   is only useful in combination with RLS.
5. **Fail closed.** Missing auth configuration disables forms and returns 503 from
   protected API routes.
6. **Typed failures.** Provider error strings are mapped to `AuthFailureCode` so the UI
   cannot accidentally surface internals.

## Manual configuration still required

1. Create a Supabase project and apply the migrations (see
   `docs/16-supabase-setup.md`).
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for the web build and
   `SUPABASE_URL` for the worker.
3. Allow-list `/auth/callback` and `/auth/reset-password` as redirect URLs.
4. Keep email confirmation enabled to exercise verification.
5. Review Supabase email templates and sender reputation before launch.

## Not in this stage

Payments, credits, AI calls, social sign-in, account deletion, MFA, session
listing/revocation and audit logs are not implemented. The dashboard deliberately shows
no tools or balances, because none exist yet.

## Open decisions for the owner

1. Free allowance size, daily cap and expiry.
2. Whether social sign-in is in scope for launch.
3. Data-retention and account-deletion policy.
