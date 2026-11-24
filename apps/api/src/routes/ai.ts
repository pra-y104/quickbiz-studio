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
import { describeAiAvailability } from '../ai/registry';
import { buildAdapterRegistry } from '../ai/adapters';
import { describeAiFailure, executeAiToolWithFailover } from '../ai/execution';
import { inMemoryAiQuotaStore } from '../ai/quota';
import { KvAiQuotaStore } from '../ai/quota-kv';
import { requireAuth } from '../middleware/auth';
import type { AiProvider } from '../ai/provider';
import { AppError } from '../lib/errors';
import { IDEMPOTENCY_HEADER, idempotencyCache, readIdempotencyKey } from '../lib/idempotency';
import { logger } from '../lib/logger';
import { parseOrThrow } from '../lib/validate';
import { ok } from '../lib/response';
import type { AppContext } from '../types/context';

export const aiRoutes = new Hono<AppContext>();

/** Daily AI run allowance per user. Enforced in the route via a pluggable store. */
export const MAX_AI_RUNS_PER_DAY = 50;

/**
 * Availability probe for the AI tools.
 *
 * Status is derived from the adapters that are actually configured, never from a
 * name in an environment variable. An adapter counts as configured only when a
 * credential is present **and** `AI_ENABLED=true`, so this endpoint cannot report
 * `ready` by accident.
 *
 * `quota` is always `null`: the per-user allowance is enforced on `/run`, not
 * advertised here.
 */
aiRoutes.get('/status', (c) => {
  const config = c.get('config');
  const { registry } = buildAdapterRegistry(c.env, config);
  const availability = describeAiAvailability(config, registry);

  const tools: AiToolStatus[] = AI_TOOL_SLUGS.map((slug) => {
    const entry = TOOL_CATALOGUE.find((tool) => tool.slug === slug);
    return {
      slug,
      status: entry?.status ?? 'planned',
      creditCost: entry?.creditCost ?? null,
      promptVersion: AI_PROMPT_VERSIONS[slug],
    };
  });

  const body: AiStatus & {
    providers: readonly { id: string; label: string; model: string }[];
  } = {
    configured: availability.configured,
    reason: availability.reason,
    requestedProvider: availability.requestedProvider,
    model: availability.model,
    quota: null,
    providers: registry.configured().map((provider) => ({
      id: provider.id,
      label: provider.label,
      model: provider.defaultModel,
    })),
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
 * - **verified email when required.** `AI_REQUIRE_VERIFIED_EMAIL` defaults to true
 *   and fails closed: a token without an `email_verified` claim is unverified.
 * - **validated before any work.** Envelope and tool input are checked against the
 *   shared schemas before a provider is considered.
 * - **idempotent.** An `Idempotency-Key` makes a retried request replay the first
 *   successful answer instead of running (and paying) twice.
 * - **fail closed.** With no registered adapter — the state of this build — the
 *   endpoint answers `503` and spends nothing.
 * - **text-safe failures.** `describeAiFailure` decides the status; provider text,
 *   keys and stack traces never reach the caller.
 *
 * Quota enforcement uses a per-isolate counter and is a cost limiter, not a
 * security boundary. Usage persistence and distributed limits remain Stage 7 work.
 */
aiRoutes.post('/run', async (c) => {
  // 1. Authenticate: an anonymous caller learns nothing about the AI surface.
  await requireAuth(c, async () => undefined);
  const identity = c.get('auth');
  if (!identity) {
    // Defensive: requireAuth throws before this point.
    throw AppError.unauthorized();
  }

  // 2. Verified email, fail-closed when the claim is absent.
  const config = c.get('config');
  if (config.ai.requireVerifiedEmail && identity.emailVerified !== true) {
    logger.warn('ai.email-unverified', {
      requestId: c.get('requestId'),
      userId: identity.userId,
    });
    throw AppError.forbidden('Confirm your email address to use AI tools.');
  }

  const requestId = c.get('requestId');
  const idempotencyKey = readIdempotencyKey(c.req.header(IDEMPOTENCY_HEADER));

  if (idempotencyKey) {
    const cached = idempotencyCache.get(identity.userId, idempotencyKey);
    if (cached) {
      c.header('Idempotent-Replay', 'true');
      return c.json(cached.body as object, cached.status as 200);
    }
  }

  // 3. Validate the request and the tool input before touching a provider.
  const body = parseOrThrow(runBodySchema, await c.req.json().catch(() => null));
  const { tool, input } = body;
  const validated: unknown = parseOrThrow(getAiToolSchemas(tool).input as ZodType<unknown>, input);

  const { registry } = buildAdapterRegistry(c.env, config);
  const availability = describeAiAvailability(config, registry);

  if (!availability.configured) {
    // Fail closed: no adapter, no key, no request, no charge.
    logger.info('ai.unavailable', { requestId, tool, userId: identity.userId });
    throw AppError.unavailable('AI generation is not available in this build.');
  }

  // 4. Cost limiter. Uses the shared KV store when a namespace is bound so the
  //    allowance holds across isolates; otherwise the per-isolate fallback. Only
  //    relevant once a provider exists.
  const quotaStore = c.env.AI_QUOTA_KV
    ? new KvAiQuotaStore(c.env.AI_QUOTA_KV)
    : inMemoryAiQuotaStore;
  const quota = await quotaStore.consume(identity.userId, MAX_AI_RUNS_PER_DAY);
  if (!quota.allowed) {
    c.header('Retry-After', String(quota.retryAfterSeconds ?? 3600));
    logger.warn('ai.quota-exhausted', { requestId, userId: identity.userId });
    throw AppError.rateLimited(
      'You have used up today’s AI allowance. Please try again tomorrow.',
      quota.retryAfterSeconds ?? 3600,
    );
  }

  // A requested provider must be the one that runs; otherwise fail closed rather
  // than silently using a different vendor's model. With no explicit request,
  // configured providers are tried in registration order with failover on
  // transient provider failures.
  let providers: readonly AiProvider[];
  if (config.ai.providerId) {
    const requested = registry.get(config.ai.providerId);
    if (!requested || !requested.isConfigured()) {
      throw AppError.unavailable('AI generation is not available in this build.');
    }
    providers = [requested];
  } else {
    providers = registry.configured();
  }
  if (providers.length === 0) {
    throw AppError.unavailable('AI generation is not available in this build.');
  }
  const startedAt = Date.now();

  try {
    const result = await executeAiToolWithFailover({
      tool,
      input: validated,
      providers,
      ...(config.ai.model === null ? {} : { model: config.ai.model }),
      signal: c.req.raw.signal,
    });

    const payload = {
      tool,
      output: result.output,
      metadata: {
        ...result.metadata,
        requestedBy: identity.userId,
      },
    };

    if (idempotencyKey) {
      idempotencyCache.put(identity.userId, idempotencyKey, { status: 200, body: payload });
    }

    logger.info('ai.run.succeeded', {
      requestId,
      tool,
      providerId: result.metadata.providerId,
      latencyMs: result.metadata.latencyMs,
      // Counts only: never the prompt or the model's text.
      inputTokens: result.metadata.usage?.inputTokens,
      outputTokens: result.metadata.usage?.outputTokens,
    });

    if (idempotencyKey) c.header('Idempotent-Replay', 'false');
    return ok(c, payload);
  } catch (error) {
    const failure = describeAiFailure(error);
    const latencyMs = Date.now() - startedAt;

    logger.warn('ai.run.failed', {
      requestId,
      tool,
      latencyMs,
      reason: failure?.reason ?? 'internal',
      kind: failure?.kind ?? 'internal',
    });

    if (!failure) throw AppError.internal();

    if (failure.kind === 'validation') {
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
