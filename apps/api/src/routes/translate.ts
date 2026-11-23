/**
 * Translation route.
 *
 * Authenticated, validated and fail-closed:
 *   * identity comes from the verified token, never the body;
 *   * the payload is validated against the shared language vocabulary before any
 *     provider is considered;
 *   * with no registered adapter — the state of this build — the endpoint answers
 *     503 and spends nothing.
 *
 * Provider text and keys never reach the caller; failures are mapped to stable
 * codes by `describeTranslationFailure`.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { AI_LANGUAGE_CODES, AI_SOURCE_LANGUAGE_CODES } from '@quickbiz/shared';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { parseOrThrow } from '../lib/validate';
import { ok } from '../lib/response';
import { resolveTranslationProvider } from '../translation/registry';
import { TranslationProviderError } from '../translation/provider';
import type { AppContext } from '../types/context';

export const translateRoutes = new Hono<AppContext>();

const translateBodySchema = z
  .object({
    text: z.string().trim().min(1).max(5_000),
    source: z.enum(AI_SOURCE_LANGUAGE_CODES).default('auto'),
    target: z.enum(AI_LANGUAGE_CODES),
  })
  .strict();

translateRoutes.post('/', async (c) => {
  await requireAuth(c, async () => undefined);
  const identity = c.get('auth');
  if (!identity) throw AppError.unauthorized();

  const body = parseOrThrow(translateBodySchema, await c.req.json().catch(() => null));

  const provider = resolveTranslationProvider(c.env);
  if (!provider || !provider.isConfigured()) {
    logger.info('translate.unavailable', {
      requestId: c.get('requestId'),
      userId: identity.userId,
    });
    throw AppError.unavailable('Translation is not available in this build.');
  }

  try {
    const result = await provider.translate({
      text: body.text,
      source: body.source,
      target: body.target,
    });
    return ok(c, {
      providerId: result.providerId,
      translatedText: result.translatedText,
      ...(result.detectedSource ? { detectedSource: result.detectedSource } : {}),
    });
  } catch (error) {
    if (error instanceof TranslationProviderError) {
      if (error.code === 'unconfigured') {
        throw AppError.unavailable('Translation is not available right now.');
      }
      throw AppError.provider();
    }
    throw AppError.provider();
  }
});
