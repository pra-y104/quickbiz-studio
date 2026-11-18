import type { MiddlewareHandler } from 'hono';
import {
  AuthTokenError,
  resolveAuthTokenConfig,
  verifyAccessToken,
  type AuthClaims,
} from '../lib/auth-tokens';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import type { AppContext } from '../types/context';

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join('');
  return token.length > 0 ? token : null;
}

/**
 * Verifies the Supabase access token and attaches the identity to the request.
 *
 * Identity always comes from the verified token. A `userId` in the body, query
 * or headers is ignored everywhere in the API.
 */
export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = readBearer(c.req.header('authorization'));
  if (!token) {
    c.header('WWW-Authenticate', 'Bearer');
    throw AppError.unauthorized('Sign in to continue.');
  }

  const config = resolveAuthTokenConfig(c.env);

  let claims: AuthClaims;
  try {
    claims = await verifyAccessToken(token, config);
  } catch (error) {
    if (error instanceof AuthTokenError) {
      if (error.reason === 'unconfigured') {
        logger.warn('auth.unconfigured', { requestId: c.get('requestId') });
        throw AppError.unavailable(
          'Authentication is not configured on this server. See the deployment documentation.',
        );
      }
      logger.warn('auth.rejected', {
        requestId: c.get('requestId'),
        reason: error.reason,
      });
      c.header('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw AppError.unauthorized(
        error.reason === 'expired'
          ? 'Your session has ended. Please sign in again.'
          : 'That session is not valid. Please sign in again.',
      );
    }
    throw error;
  }

  c.set('auth', claims);
  await next();
};
