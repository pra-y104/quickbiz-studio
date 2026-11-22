/**
 * Idempotency for AI runs.
 *
 * A retried request (timeout, flaky mobile network, double tap) must not run the
 * provider twice and bill twice. Callers send an `Idempotency-Key`; the first
 * successful response for a user+key pair is remembered and replayed.
 *
 * Limits, stated honestly:
 *
 * - the cache is per isolate, so a retry routed to another isolate will run again;
 * - only successful responses are cached, and they expire after ten minutes;
 * - entries hold the caller's own result in memory, never on disk.
 *
 * A durable, shared idempotency store is required before paid usage is at stake.
 */

export interface CachedRun {
  readonly status: number;
  readonly body: unknown;
  readonly storedAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

export class InMemoryIdempotencyCache {
  readonly #entries = new Map<string, CachedRun>();

  #key(userId: string, key: string): string {
    return `${userId}:${key}`;
  }

  #prune(now: number): void {
    for (const [key, entry] of this.#entries) {
      if (entry.storedAt + TTL_MS <= now) this.#entries.delete(key);
    }
    if (this.#entries.size > MAX_ENTRIES) {
      const oldest = [...this.#entries.entries()]
        .sort((a, b) => a[1].storedAt - b[1].storedAt)
        .slice(0, this.#entries.size - MAX_ENTRIES);
      for (const [key] of oldest) this.#entries.delete(key);
    }
  }

  get(userId: string, key: string, now = Date.now()): CachedRun | undefined {
    const entry = this.#entries.get(this.#key(userId, key));
    if (!entry) return undefined;
    if (entry.storedAt + TTL_MS <= now) {
      this.#entries.delete(this.#key(userId, key));
      return undefined;
    }
    return entry;
  }

  put(userId: string, key: string, entry: Omit<CachedRun, 'storedAt'>, now = Date.now()): void {
    this.#prune(now);
    this.#entries.set(this.#key(userId, key), { ...entry, storedAt: now });
  }

  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    return this.#entries.size;
  }
}

export const idempotencyCache = new InMemoryIdempotencyCache();

/** Header name, kept in one place so the route and tests agree. */
export const IDEMPOTENCY_HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 128;

/** Read a usable key, or null when the header is absent or malformed. */
export function readIdempotencyKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_KEY_LENGTH) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return null;
  return trimmed;
}
