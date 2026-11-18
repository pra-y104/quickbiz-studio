import type { MiddlewareHandler } from 'hono';
import { resolveConfig } from '../config/env';
import { logger } from '../lib/logger';
import type { AppContext } from '../types/context';

/**
 * Assigns a request id, resolves configuration, and emits one structured log
 * line per request. Request ids are echoed to the client so support can trace
 * a specific failure.
 */
export const requestContext: MiddlewareHandler<AppContext> = async (c, next) => {
  const requestId = c.req.header('x-request-id')?.slice(0, 64) ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.set('startedAt', Date.now());
  c.set('config', resolveConfig(c.env));
  c.header('x-request-id', requestId);

  try {
    await next();
  } finally {
    const url = new URL(c.req.url);
    logger.info('request.completed', {
      requestId,
      method: c.req.method,
      path: url.pathname,
      status: c.res.status,
      durationMs: Date.now() - c.get('startedAt'),
      environment: c.get('config').environment,
    });
  }
};
