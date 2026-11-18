import { Hono } from 'hono';
import { ok } from '../lib/response';
import { requireAuth } from '../middleware/auth';
import type { AppContext } from '../types/context';

export const meRoutes = new Hono<AppContext>();

meRoutes.use('*', requireAuth);

/**
 * Returns the identity derived from the verified access token.
 * It deliberately does not read any user id from the request.
 */
meRoutes.get('/', (c) => {
  const auth = c.get('auth');
  if (!auth) {
    // Defensive: requireAuth should have thrown before this point.
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } }, 401);
  }

  return ok(c, {
    id: auth.userId,
    email: auth.email,
    role: auth.role,
    sessionId: auth.sessionId,
    expiresAt: new Date(auth.expiresAt * 1000).toISOString(),
  });
});
