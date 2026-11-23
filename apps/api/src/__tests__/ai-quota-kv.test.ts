import { describe, expect, it } from 'vitest';
import { KvAiQuotaStore, type KvLike } from '../ai/quota-kv';
import { InMemoryAiQuotaStore } from '../ai/quota';

/** In-memory fake of the subset of KV the quota store uses. */
class FakeKv implements KvLike {
  readonly data = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

describe('KvAiQuotaStore', () => {
  it('allows up to the limit within a day and then blocks', async () => {
    const store = new KvAiQuotaStore(new FakeKv());
    const now = 1_000_000;

    expect(await store.consume('u1', 2, now)).toEqual({ allowed: true });
    expect(await store.consume('u1', 2, now + 1)).toEqual({ allowed: true });

    const blocked = await store.consume('u1', 2, now + 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('shares the allowance across store instances on the same namespace', async () => {
    const kv = new FakeKv();
    const a = new KvAiQuotaStore(kv);
    const b = new KvAiQuotaStore(kv);
    const now = 2_000_000;

    expect((await a.consume('u1', 1, now)).allowed).toBe(true);
    // A different isolate (a different store object) sees the same counter.
    expect((await b.consume('u1', 1, now + 1)).allowed).toBe(false);
  });

  it('treats an unlimited or non-positive limit as always allowed', async () => {
    const store = new KvAiQuotaStore(new FakeKv());
    expect(await store.consume('u1', null, 0)).toEqual({ allowed: true });
    expect(await store.consume('u1', 0, 0)).toEqual({ allowed: true });
  });

  it('reports remaining runs and resets after the day window', async () => {
    const store = new KvAiQuotaStore(new FakeKv());
    const now = 3_000_000;

    expect(await store.remaining('u1', 5, now)).toBe(5);
    await store.consume('u1', 5, now);
    expect(await store.remaining('u1', 5, now)).toBe(4);

    const day = 24 * 60 * 60 * 1000;
    expect(await store.remaining('u1', 5, now + day + 1)).toBe(5);
    expect((await store.consume('u1', 5, now + day + 1)).allowed).toBe(true);
  });

  it('reset clears the counter', async () => {
    const store = new KvAiQuotaStore(new FakeKv());
    await store.consume('u1', 1, 0);
    expect((await store.consume('u1', 1, 1)).allowed).toBe(false);
    await store.reset('u1');
    expect((await store.consume('u1', 1, 2)).allowed).toBe(true);
  });
});

describe('quota store contract parity', () => {
  it('in-memory and KV stores agree on a simple sequence', async () => {
    const memory = new InMemoryAiQuotaStore();
    const kv = new KvAiQuotaStore(new FakeKv());
    const now = 4_000_000;

    for (const store of [memory, kv]) {
      expect((await store.consume('u1', 2, now)).allowed).toBe(true);
      expect((await store.consume('u1', 2, now)).allowed).toBe(true);
      expect((await store.consume('u1', 2, now)).allowed).toBe(false);
      expect(await store.remaining('u1', 2, now)).toBe(0);
    }
  });
});
