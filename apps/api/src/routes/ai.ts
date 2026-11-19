import { Hono } from 'hono';
import {
  AI_PROMPT_VERSIONS,
  AI_TOOL_SLUGS,
  TOOL_CATALOGUE,
  type AiStatus,
  type AiToolStatus,
} from '@quickbiz/shared';
import { describeAiAvailability, productionRegistry } from '../ai/registry';
import { AppError } from '../lib/errors';
import { ok } from '../lib/response';
import type { AppContext } from '../types/context';

export const aiRoutes = new Hono<AppContext>();

/**
 * Availability probe for the AI tools.
 *
 * Status is derived from the provider registry, not from environment variables.
 * An environment may name a preferred provider and model, but that is only a
 * preference: this build registers no adapter, so the endpoint keeps reporting
 * `no-adapters-registered` and `configured: false`.
 *
 * `quota` is always `null`. No allowance is enforced anywhere yet, so the API
 * must not imply that one exists.
 */
aiRoutes.get('/status', (c) => {
  const config = c.get('config');
  const availability = describeAiAvailability(config, productionRegistry);

  const tools: AiToolStatus[] = AI_TOOL_SLUGS.map((slug) => {
    const entry = TOOL_CATALOGUE.find((tool) => tool.slug === slug);
    return {
      slug,
      status: entry?.status ?? 'planned',
      creditCost: entry?.creditCost ?? null,
      promptVersion: AI_PROMPT_VERSIONS[slug],
    };
  });

  const body: AiStatus = {
    configured: availability.configured,
    reason: availability.reason,
    requestedProvider: availability.requestedProvider,
    model: availability.model,
    quota: null,
    tools,
    total: tools.length,
  };

  return ok(c, body);
});

/**
 * Generation is intentionally absent in M1A. The route exists so a client gets
 * a stable, explicit answer instead of an ambiguous 404 from the router, and so
 * a test can prove no HTTP path in this build can spend money on a provider.
 */
aiRoutes.post('/run', () => {
  throw AppError.notImplemented('AI generation is not available in this build.');
});
