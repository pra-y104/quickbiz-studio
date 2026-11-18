import { Hono } from 'hono';
import { APP_NAME, APP_TAGLINE, TOOL_CATALOGUE } from '@quickbiz/shared';
import { ok } from '../lib/response';
import type { AppContext } from '../types/context';

export const metaRoutes = new Hono<AppContext>();

/** Public, non-sensitive platform metadata used by the frontend shell. */
metaRoutes.get('/', (c) => {
  const config = c.get('config');
  return ok(c, {
    name: APP_NAME,
    tagline: APP_TAGLINE,
    apiVersion: 'v1',
    version: config.appVersion,
    environment: config.environment,
    toolCount: TOOL_CATALOGUE.length,
  });
});
