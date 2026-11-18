import type { MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors';
import type { AppContext } from '../types/context';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiting held in worker memory.
 *
 * LIMITATION: Cloudflare isolates are ephemeral and replicated, so this limit is
 * per isolate, not global. It stops runaway loops and casual abuse but is not a
 * hard guarantee. Before public launch this must be backed by a shared store
 * (Cloudflare rate limiting rules, Durable Objects or KV). Documented in
 * docs/08-security.md.
 */
const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

function clientKey(c: Parameters<MiddlewareHandler<AppContext>>[0]): string {
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
  return ip.split(',')[0]?.trim() ?? 'unknown';
}

function pruneExpired(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
}

export const rateLimit: MiddlewareHandler<AppContext> = async (c, next) => {
  const { rateLimit: limits } = c.get('config');
  if (!limits.enabled) {
    await next();
    return;
  }

  const now = Date.now();
  pruneExpired(now);

  const key = `${clientKey(c)}:${new URL(c.req.url).pathname}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limits.windowSeconds * 1000 });
  } else if (existing.count >= limits.maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    c.header('Retry-After', String(retryAfter));
    throw AppError.rateLimited(undefined, retryAfter);
  } else {
    existing.count += 1;
  }

  await next();
};
