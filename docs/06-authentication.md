# Authentication strategy (Stage 4)

Supabase Auth handles credentials, verification and password reset. The API verifies
the resulting JWT on every protected request.

## Flows

| Flow | Behaviour |
|---|---|
| Register | Email + password, minimum 8 characters, strength feedback, generic success message |
| Verify email | Required before any AI action; link returns to `/auth/callback` on our domain |
| Login | Email + password, short-lived access token + refresh token |
| Forgot password | Always responds "if that address exists, a link was sent" (no account enumeration) |
| Reset password | Single-use, time-limited token, then full session reset |
| Sign out | Clears local session; server-side revocation at Stage 9 as hardening |

## Session handling

- Access token is sent as `Authorization: Bearer <jwt>` to the API.
- The API verifies signature and expiry and derives `user_id` from the token claims.
- A `userId` in a request body is ignored. This is non-negotiable.
- Tokens are stored by the Supabase client library; they never appear in URLs.

## Free allowance

- Granted once, on first successful email verification.
- Recorded in `free_allowance_grants` with a unique constraint so a replayed callback
  cannot grant twice.
- Size and daily cap come from `platform_settings`, not hard-coded values, because
  the owner has not approved final numbers yet.
- Free credits may expire (disclosed). Purchased credits never expire.

## Abuse controls

- Per-IP and per-email signup throttle.
- Disposable email domain blocklist (configurable list).
- Honeypot field plus optional Cloudflare Turnstile on registration only.
- Daily free-usage cap independent of the credit balance.
- Hashed device/IP signals stored for anomaly review only, with a documented
  retention period.

## What is not built yet

Nothing in this document is implemented in Stage 2. There are no auth screens, no
sessions and no user tables. This is the plan that Stage 4 implements and tests.

## Open decisions for the owner

1. Free allowance size and daily cap (numbers).
2. Whether free credits expire, and after how long.
3. Whether social sign-in (Google/Apple) is in scope for launch.
