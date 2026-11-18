import { Hono } from 'hono';
import { ok } from '../lib/response';
import type { AppContext } from '../types/context';

export const healthRoutes = new Hono<AppContext>();

/**
 * Liveness probe. Intentionally dependency-free: it reports that the worker is
 * running, not that every downstream service is healthy.
 */
healthRoutes.get('/', (c) => {
  const config = c.get('config');
  return ok(c, {
    status: 'ok',
    service: 'quickbiz-studio-api',
    version: config.appVersion,
    environment: config.environment,
    timestamp: new Date().toISOString(),
  });
});
