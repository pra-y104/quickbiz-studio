import type { MiddlewareHandler } from 'hono';
import type { AppConfig } from '../config/env';
import type { AppContext } from '../types/context';

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,Authorization,X-Request-Id';
const EXPOSED_HEADERS = 'X-Request-Id';

/**
 * Strict CORS: only configured origins are allowed. Wildcards are rejected in
 * production configuration at Stage 9 review time.
 */
export function createCors(config: AppConfig): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const origin = c.req.header('origin');
    const allowed = origin !== undefined && config.allowedOrigins.includes(origin);

    if (origin) {
      c.header('Vary', 'Origin');
    }
    if (allowed && origin) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', ALLOWED_METHODS);
      c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      c.header('Access-Control-Expose-Headers', EXPOSED_HEADERS);
      c.header('Access-Control-Max-Age', '86400');
    }

    if (c.req.method === 'OPTIONS') {
      // Preflight never reaches route handlers.
      return c.body(null, 204);
    }

    await next();
  };
}
