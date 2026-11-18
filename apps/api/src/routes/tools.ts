import { Hono } from 'hono';
import { TOOL_CATALOGUE, listToolsQuerySchema } from '@quickbiz/shared';
import { ok } from '../lib/response';
import { parseOrThrow } from '../lib/validate';
import type { AppContext } from '../types/context';

export const toolRoutes = new Hono<AppContext>();

/**
 * Read-only catalogue endpoint. Pricing and availability live server-side so the
 * frontend can never decide a credit cost on its own.
 */
toolRoutes.get('/', (c) => {
  const query = parseOrThrow(listToolsQuerySchema, c.req.query());
  const search = query.q?.toLowerCase();

  const tools = TOOL_CATALOGUE.filter((tool) => {
    if (query.kind && tool.kind !== query.kind) return false;
    if (query.category && tool.category !== query.category) return false;
    if (query.status && tool.status !== query.status) return false;
    if (search) {
      const haystack = `${tool.name} ${tool.summary}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return ok(c, { tools, total: tools.length });
});
