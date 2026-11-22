/**
 * Per-user daily run allowance.
 *
 * This is **not** a security boundary. It is a cost-damage limiter that stops one
 * account from firing hundreds of runs in a loop against a paid provider. It is
 * held in worker memory, so it is per isolate and resets when the isolate is
 * recycled; a distributed counter (Durable Object, KV or database) is required
 * before this can be relied on for billing or abuse prevention.
 *
 * The interface exists so a shared implementation can replace the in-memory one
 * without touching the route.
 */

export interface AiQuotaStore {
  /** Seconds until the caller's allowance resets, or null when unlimited. */
  consume(
    userId: string,
    limit: number | null,
    now?: number,
  ): { allowed: boolean; retryAfterSeconds?: number };
  /** Remaining runs today, or null when no limit applies. */
  remaining(userId: string, limit: number | null, now?: number): number | null;
  reset(userId: string): void;
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

  consume(
    userId: string,
    limit: number | null,
    now = Date.now(),
  ): { allowed: boolean; retryAfterSeconds?: number } {
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
