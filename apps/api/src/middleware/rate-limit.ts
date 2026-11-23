import type { MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors';
import type { AppContext } from '../types/context';
import { defaultRateLimitStore, rateLimitKey, type RateLimitStore } from './rate-limit-store';

/**
 * Fixed-window rate limiting backed by a shared store interface.
 *
 * The default store is per-isolate (see `rate-limit-store.ts`). Production must
 * inject a distributed store (KV, Durable Object or a Cloudflare rate-limit
 * rule) before this endpoint is public. The middleware no longer owns a `Map`;
 * it delegates to the injected store so the backing can change without editing
 * request handling.
 */
export function createRateLimit(store: RateLimitStore = defaultRateLimitStore) {
  const handler: MiddlewareHandler<AppContext> = async (c, next) => {
    const { rateLimit: limits } = c.get('config');
    if (!limits.enabled) {
      await next();
      return;
    }

    const clientKey =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';
    const key = rateLimitKey({ clientKey, path: new URL(c.req.url).pathname });
    const windowMs = limits.windowSeconds * 1000;

    const decision = await store.hit(key, limits.maxRequests, windowMs);
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds));
      c.header('X-RateLimit-Limit', String(limits.maxRequests));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));
      throw AppError.rateLimited(undefined, decision.retryAfterSeconds);
    }

    c.header('X-RateLimit-Limit', String(limits.maxRequests));
    c.header('X-RateLimit-Remaining', String(decision.remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));

    await next();
  };

  return handler;
}

/** Default middleware instance bound to the per-isolate store. */
export const rateLimit: MiddlewareHandler<AppContext> = createRateLimit();
