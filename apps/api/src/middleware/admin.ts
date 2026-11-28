import type { MiddlewareHandler } from 'hono';
import type { AppConfig } from '../config/env';
import { AppError } from '../lib/errors';
import type { AuthClaims } from '../lib/auth-tokens';
import type { AppContext } from '../types/context';

/**
 * Server-side admin authorization.
 *
 * Admin status is decided **only** from the verified access token plus the
 * server-side allow-list (`ADMIN_USER_IDS` / `ADMIN_EMAILS`). The token's `role`
 * claim is the Supabase Postgres role (`authenticated`) and is never treated as
 * an app-level admin flag, so a user cannot grant themselves admin by editing a
 * profile, a request body, or a header.
 *
 * `requireAdmin` must run after `requireAuth`. It fails closed: when the
 * allow-list is empty, nobody is an admin.
 */
export function isAdmin(claims: AuthClaims, config: AppConfig): boolean {
  if (config.admin.userIds.includes(claims.userId)) return true;
  const email = claims.email?.trim().toLowerCase();
  if (email && config.admin.emails.includes(email)) return true;
  return false;
}

export const requireAdmin: MiddlewareHandler<AppContext> = async (c, next) => {
  const auth = c.get('auth');
  if (!auth) {
    // Defensive: requireAuth runs first and throws before this point.
    throw AppError.unauthorized('Sign in to continue.');
  }

  if (!isAdmin(auth, c.get('config'))) {
    throw AppError.forbidden('You do not have access to the admin dashboard.');
  }

  await next();
};
