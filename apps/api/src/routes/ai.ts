import { Hono } from 'hono';
import { z, type ZodType } from 'zod';
import {
  AI_PROMPT_VERSIONS,
  AI_TOOL_SLUGS,
  TOOL_CATALOGUE,
  getAiToolSchemas,
  isAiToolSlug,
  type AiStatus,
  type AiToolStatus,
} from '@quickbiz/shared';
import { describeAiAvailability, productionRegistry } from '../ai/registry';
import { describeAiFailure, executeAiTool } from '../ai/execution';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { parseOrThrow } from '../lib/validate';
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

/** Request body: a tool slug plus its raw input. Unknown keys are rejected. */
const runBodySchema = z
  .object({
    tool: z.string().refine(isAiToolSlug, 'unknown AI tool'),
    input: z.unknown(),
  })
  .strict();

/**
 * Run one AI tool.
 *
 * Security posture (M2):
 *
 * - **authenticated only.** Identity comes from the verified token, never the body.
 * - **validated before any work.** The tool slug and input are checked against the
 *   shared schemas; an invalid request never reaches a provider.
 * - **fail closed.** With no registered adapter — the state of this build — the
 *   endpoint answers `503` and spends nothing. It never falls back to a different
 *   provider or fabricates a result.
 * - **text-safe failures.** `describeAiFailure` decides the status; provider text,
 *   keys and stack traces never reach the caller.
 *
 * Quota enforcement and usage persistence are Stage 7 concerns and are not
 * implemented here, so `quota` stays `null` and no allowance is implied.
 */
aiRoutes.post('/run', async (c) => {
  // Authentication first: an anonymous caller learns nothing about the AI surface.
  await requireAuth(c, async () => undefined);

  const body = parseOrThrow(runBodySchema, await c.req.json().catch(() => null));
  const { tool, input } = body;

  // Validate the tool's input before touching the provider.
  // The registry returns a union of schemas; parse as unknown and keep the validated value opaque.
  const validated: unknown = parseOrThrow(getAiToolSchemas(tool).input as ZodType<unknown>, input);

  const config = c.get('config');
  const availability = describeAiAvailability(config, productionRegistry);

  if (!availability.configured) {
    // Fail closed: no adapter, no key, no request, no charge.
    throw AppError.unavailable('AI generation is not available in this build.');
  }

  const provider = productionRegistry.require(config.ai.providerId ?? '');
  const identity = c.get('auth');

  try {
    const result = await executeAiTool({
      tool,
      input: validated,
      provider,
      ...(config.ai.model === null ? {} : { model: config.ai.model }),
      signal: c.req.raw.signal,
    });

    return ok(c, {
      tool,
      output: result.output,
      metadata: {
        ...result.metadata,
        // Recorded for the caller's own audit; never a provider payload.
        requestedBy: identity?.userId,
      },
    });
  } catch (error) {
    const failure = describeAiFailure(error);
    if (!failure) {
      // Programmer error: generic 500, no internal detail.
      throw AppError.internal();
    }

    if (failure.kind === 'validation') {
      // Output paths only; never the model's text.
      throw AppError.validation(
        (failure.issues ?? []).map((path) => ({ path, message: 'Invalid value.' })),
      );
    }

    if (failure.kind === 'unavailable') {
      throw AppError.unavailable('AI generation is not available right now.');
    }

    if (failure.reason === 'rate-limited') {
      throw AppError.rateLimited(undefined, failure.retryAfterSeconds ?? 60);
    }

    throw AppError.provider();
  }
});
