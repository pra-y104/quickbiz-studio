import { Hono } from 'hono';
import { createCors } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { rateLimit } from './middleware/rate-limit';
import { createRateLimit } from './middleware/rate-limit';
import { KvRateLimitStore } from './middleware/rate-limit-store';
import { requestContext } from './middleware/request-context';
import { securityHeaders } from './middleware/security-headers';
import { healthRoutes } from './routes/health';
import { apiRoutes } from './routes';
import { ok } from './lib/response';
import type { AppContext } from './types/context';

/**
 * Builds the worker application. Exported separately from the entry point so
 * tests can exercise the exact middleware chain that runs in production.
 */
export function createApp(): Hono<AppContext> {
  const app = new Hono<AppContext>();

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  app.use('*', requestContext);
  app.use('*', async (c, next) => createCors(c.get('config'))(c, next));
  app.use('*', securityHeaders);

  // Prefer a shared KV-backed store when a namespace is bound; otherwise the
  // per-isolate default. The binding is resolved per request from config.
  app.use('/api/*', async (c, next) => {
    const kv = c.get('config').rateLimit.kvNamespace;
    const handler = kv === null ? rateLimit : createRateLimit(new KvRateLimitStore(kv, 'rl'));
    await handler(c, next);
  });

  app.route('/health', healthRoutes);

  app.get('/', (c) =>
    ok(c, {
      service: 'quickbiz-studio-api',
      message: 'QuickBiz Studio API. See /health and /api/v1/meta.',
    }),
  );

  app.route('/api/v1', apiRoutes);

  return app;
}
