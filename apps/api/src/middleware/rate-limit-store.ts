/**
 * Shared rate-limit store abstraction.
 *
 * The original limiter kept a `Map` in worker memory. Cloudflare isolates are
 * ephemeral and replicated, so that limit is per isolate: ten isolates mean ten
 * times the intended allowance. This module defines the store contract and ships
 * two implementations:
 *
 * - `InMemoryRateLimitStore` — the default. Correct for a single isolate and for
 *   tests; **not** a distributed guarantee.
 * - `KvRateLimitStore` — writes counters to a Cloudflare KV namespace. KV is
 *   eventually consistent, so a burst can briefly exceed the limit across
 *   regions. It is a genuine shared store, not per isolate, and is the minimum
 *   acceptable backing for a public endpoint. For strict limits, a Durable
 *   Object or Cloudflare's native rate-limiting rules are stronger.
 *
 * The store is deliberately tiny so it can be swapped without touching routes.
 */

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Unix milliseconds when the window resets. */
  readonly resetAt: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimitStore {
  /** Increment the counter for `key` and decide whether the call is allowed. */
  hit(key: string, limit: number, windowMs: number, now?: number): Promise<RateLimitDecision>;
  /** Current count for `key` without incrementing. 0 when unknown or expired. */
  peek(key: string, now?: number): Promise<number>;
}

export interface RateLimitKeyParts {
  readonly clientKey: string;
  readonly path: string;
}

export function rateLimitKey(parts: RateLimitKeyParts): string {
  return `rl:${parts.clientKey}:${parts.path}`;
}

/** In-memory fixed-window store. Correct per isolate; not distributed. */
export class InMemoryRateLimitStore implements RateLimitStore {
  readonly #buckets = new Map<string, { count: number; resetAt: number }>();
  readonly #maxTracked: number;

  constructor(maxTracked = 5_000) {
    this.#maxTracked = maxTracked;
  }

  #prune(now: number): void {
    if (this.#buckets.size < this.#maxTracked) return;
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now) this.#buckets.delete(key);
    }
    if (this.#buckets.size >= this.#maxTracked) this.#buckets.clear();
  }

  async hit(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): Promise<RateLimitDecision> {
    this.#prune(now);
    const existing = this.#buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      this.#buckets.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count),
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  async peek(key: string, now = Date.now()): Promise<number> {
    const bucket = this.#buckets.get(key);
    if (!bucket || bucket.resetAt <= now) return 0;
    return bucket.count;
  }

  clear(): void {
    this.#buckets.clear();
  }
}

/** Minimal KV surface, so tests can supply a fake and workers can pass a real binding. */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface KvBucket {
  readonly count: number;
  readonly resetAt: number;
}

/**
 * KV-backed fixed-window store.
 *
 * `get` then `put` is not atomic, so two concurrent isolates can both read the
 * old count and each write `count + 1`, under-counting by one per race. The
 * tradeoff is explicit: this closes the *per-isolate* hole for a public endpoint
 * at the cost of a small, bounded overshoot under load. It is documented in
 * docs/22-stage-6-m2-secure-execution.md and must be replaced by a Durable
 * Object or native rule for strict accounting.
 */
export class KvRateLimitStore implements RateLimitStore {
  readonly #kv: KvLike;
  readonly #prefix: string;

  constructor(kv: KvLike, prefix = 'rl') {
    this.#kv = kv;
    this.#prefix = prefix;
  }

  async hit(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): Promise<RateLimitDecision> {
    const storageKey = `${this.#prefix}:${key}`;
    const raw = await this.#kv.get(storageKey);

    let bucket: KvBucket | null = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as KvBucket;
        if (typeof parsed.count === 'number' && typeof parsed.resetAt === 'number') {
          bucket = parsed;
        }
      } catch {
        bucket = null;
      }
    }

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      const fresh: KvBucket = { count: 1, resetAt };
      await this.#kv.put(storageKey, JSON.stringify(fresh), {
        expirationTtl: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      });
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    const next: KvBucket = { count: bucket.count + 1, resetAt: bucket.resetAt };
    await this.#kv.put(storageKey, JSON.stringify(next), {
      expirationTtl: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - next.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  async peek(key: string, now = Date.now()): Promise<number> {
    const raw = await this.#kv.get(`${this.#prefix}:${key}`);
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw) as KvBucket;
      if (typeof parsed.count !== 'number' || typeof parsed.resetAt !== 'number') return 0;
      return parsed.resetAt <= now ? 0 : parsed.count;
    } catch {
      return 0;
    }
  }
}

/** Default store for this isolate. Replace with `KvRateLimitStore` once a KV binding exists. */
export const defaultRateLimitStore: RateLimitStore = new InMemoryRateLimitStore();
