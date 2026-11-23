/**
 * KV-backed AI quota store.
 *
 * The in-memory quota (`quota.ts`) is per isolate. This implementation writes the
 * per-user daily counter to Cloudflare KV so the allowance is shared across
 * isolates. KV is eventually consistent, so a burst straddling the boundary can
 * briefly overshoot; it is a genuine cross-isolate cost limiter, not a per-process
 * one. For strict accounting, a Durable Object or database counter is stronger —
 * documented in docs/22-stage-6-m2-secure-execution.md.
 */

import type { AiQuotaDecision, AiQuotaStore } from './quota';

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface QuotaWindow {
  readonly count: number;
  readonly resetAt: number;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export class KvAiQuotaStore implements AiQuotaStore {
  readonly #kv: KvLike;
  readonly #prefix: string;

  constructor(kv: KvLike, prefix = 'ai-quota') {
    this.#kv = kv;
    this.#prefix = prefix;
  }

  async consume(userId: string, limit: number | null, now = Date.now()): Promise<AiQuotaDecision> {
    if (limit === null || limit <= 0) return { allowed: true };

    const key = `${this.#prefix}:${userId}`;
    const raw = await this.#kv.get(key);

    let window: QuotaWindow | null = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as QuotaWindow;
        if (typeof parsed.count === 'number' && typeof parsed.resetAt === 'number') {
          window = parsed;
        }
      } catch {
        window = null;
      }
    }

    if (!window || window.resetAt <= now) {
      const resetAt = now + WINDOW_MS;
      await this.#kv.put(key, JSON.stringify({ count: 1, resetAt }), {
        expirationTtl: Math.max(1, Math.ceil(WINDOW_MS / 1000)),
      });
      return { allowed: true };
    }

    if (window.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
      };
    }

    await this.#kv.put(key, JSON.stringify({ count: window.count + 1, resetAt: window.resetAt }), {
      expirationTtl: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    });
    return { allowed: true };
  }

  async remaining(userId: string, limit: number | null, now = Date.now()): Promise<number | null> {
    if (limit === null) return null;
    const raw = await this.#kv.get(`${this.#prefix}:${userId}`);
    if (!raw) return limit;
    try {
      const parsed = JSON.parse(raw) as QuotaWindow;
      if (typeof parsed.count !== 'number' || typeof parsed.resetAt !== 'number') return limit;
      if (parsed.resetAt <= now) return limit;
      return Math.max(0, limit - parsed.count);
    } catch {
      return limit;
    }
  }

  async reset(userId: string): Promise<void> {
    await this.#kv.delete(`${this.#prefix}:${userId}`);
  }
}
