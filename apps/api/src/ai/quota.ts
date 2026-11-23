/**
 * Per-user daily AI run allowance.
 *
 * This is a cost-damage limiter, not a security boundary: it stops one account
 * from firing hundreds of runs in a loop against a paid provider. Two stores are
 * provided behind one contract:
 *
 * - `InMemoryAiQuotaStore` — the default. Per isolate and reset when the isolate
 *   is recycled; fine for tests and single-instance development, not distributed.
 * - `KvAiQuotaStore` (see `quota-kv.ts`) — a shared KV-backed counter, so the
 *   allowance holds across isolates. KV is eventually consistent, so a burst at
 *   the window boundary can briefly overshoot; a Durable Object or database
 *   counter is stronger. Documented in docs/22-stage-6-m2-secure-execution.md.
 *
 * Both satisfy the same interface so the route can switch on configuration
 * without knowing which backing is in use.
 */

export interface AiQuotaDecision {
  readonly allowed: boolean;
  retryAfterSeconds?: number;
}

export interface AiQuotaStore {
  /** Seconds until the caller's allowance resets, or null when unlimited. */
  consume(
    userId: string,
    limit: number | null,
    now?: number,
  ): AiQuotaDecision | Promise<AiQuotaDecision>;
  /** Remaining runs today, or null when no limit applies. */
  remaining(
    userId: string,
    limit: number | null,
    now?: number,
  ): number | null | Promise<number | null>;
  reset(userId: string): void | Promise<void>;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_USERS = 10_000;

interface Window {
  count: number;
  resetAt: number;
}

export class InMemoryAiQuotaStore implements AiQuotaStore {
  readonly #windows = new Map<string, Window>();

  #prune(now: number): void {
    if (this.#windows.size < MAX_TRACKED_USERS) return;
    for (const [key, window] of this.#windows) {
      if (window.resetAt <= now) this.#windows.delete(key);
    }
    if (this.#windows.size >= MAX_TRACKED_USERS) this.#windows.clear();
  }

  consume(userId: string, limit: number | null, now = Date.now()): AiQuotaDecision {
    if (limit === null || limit <= 0) return { allowed: true };

    this.#prune(now);
    const existing = this.#windows.get(userId);

    if (!existing || existing.resetAt <= now) {
      this.#windows.set(userId, { count: 1, resetAt: now + WINDOW_MS });
      return { allowed: true };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return { allowed: true };
  }

  remaining(userId: string, limit: number | null, now = Date.now()): number | null {
    if (limit === null) return null;
    const window = this.#windows.get(userId);
    if (!window || window.resetAt <= now) return limit;
    return Math.max(0, limit - window.count);
  }

  reset(userId: string): void {
    this.#windows.delete(userId);
  }
}

export const inMemoryAiQuotaStore: AiQuotaStore = new InMemoryAiQuotaStore();
