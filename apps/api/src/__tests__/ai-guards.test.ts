import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryAiQuotaStore, inMemoryAiQuotaStore } from '../ai/quota';
import { InMemoryIdempotencyCache, readIdempotencyKey } from '../lib/idempotency';

describe('AI quota (cost limiter, not a security boundary)', () => {
  let store: InMemoryAiQuotaStore;

  beforeEach(() => {
    store = new InMemoryAiQuotaStore();
    inMemoryAiQuotaStore.reset('nobody');
  });

  it('allows requests up to the limit', () => {
    const now = 1_000_000;
    for (let index = 0; index < 3; index += 1) {
      expect(store.consume('u1', 3, now).allowed).toBe(true);
    }
    const result = store.consume('u1', 3, now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets in a new window', () => {
    const now = 1_000_000;
    store.consume('u1', 1, now);
    expect(store.consume('u1', 1, now + 1).allowed).toBe(false);
    expect(store.consume('u1', 1, now + 25 * 60 * 60 * 1000).allowed).toBe(true);
  });

  it('treats a null or zero limit as unlimited', () => {
    expect(store.consume('u1', null).allowed).toBe(true);
    expect(store.consume('u1', 0).allowed).toBe(true);
  });

  it('tracks users independently', () => {
    store.consume('a', 1, 1_000);
    expect(store.consume('a', 1, 1_000).allowed).toBe(false);
    expect(store.consume('b', 1, 1_000).allowed).toBe(true);
  });

  it('reports remaining runs', () => {
    const now = 1_000;
    store.consume('u1', 3, now);
    expect(store.remaining('u1', 3, now)).toBe(2);
    expect(store.remaining('other', 3, now)).toBe(3);
    expect(store.remaining('u1', null, now)).toBeNull();
  });
});

describe('idempotency cache', () => {
  let cache: InMemoryIdempotencyCache;

  beforeEach(() => {
    cache = new InMemoryIdempotencyCache();
  });

  it('replays a stored response', () => {
    cache.put('u1', 'key-1', { status: 200, body: { data: { tool: 'ai-writer' } } }, 1_000);
    const entry = cache.get('u1', 'key-1', 1_001);
    expect(entry?.status).toBe(200);
    expect(cache.size).toBe(1);
  });

  it('expires entries after ten minutes', () => {
    cache.put('u1', 'key-1', { status: 200, body: {} }, 0);
    expect(cache.get('u1', 'key-1', 10 * 60 * 1000)).toBeUndefined();
  });

  it('isolates keys by user', () => {
    cache.put('u1', 'same-key', { status: 200, body: { owner: 'u1' } }, 0);
    expect(cache.get('u2', 'same-key', 0)).toBeUndefined();
  });

  it('rejects malformed idempotency keys', () => {
    expect(readIdempotencyKey(null)).toBeNull();
    expect(readIdempotencyKey('   ')).toBeNull();
    expect(readIdempotencyKey('has spaces')).toBeNull();
    expect(readIdempotencyKey('a'.repeat(200))).toBeNull();
    expect(readIdempotencyKey('run-2026_11:abc')).toBe('run-2026_11:abc');
  });
});
