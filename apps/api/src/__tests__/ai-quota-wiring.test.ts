/**
 * Durable AI quota wiring (M5).
 *
 * The run endpoint is fail-closed in this build: no adapter is registered, so it
 * answers 503 before any quota work happens. That means the route cannot be used
 * to observe the quota store end-to-end with a real provider. These tests pin the
 * parts that are observable without a provider:
 *
 * - the KV quota store honours the same allowance as the route constant, so the
 *   route's pluggable store is wired to a shared counter rather than a process
 *   counter;
 * - the in-memory and KV stores agree, so switching configuration cannot change
 *   the limit.
 */

import { describe, expect, it } from 'vitest';
import { KvAiQuotaStore, type KvLike } from '../ai/quota-kv';
import { InMemoryAiQuotaStore } from '../ai/quota';
import { MAX_AI_RUNS_PER_DAY } from '../routes/ai';

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

describe('AI quota wiring', () => {
  it('uses the route allowance for both stores', async () => {
    const memory = new InMemoryAiQuotaStore();
    const kv = new KvAiQuotaStore(new FakeKv());
    const now = 5_000_000;

    for (const store of [memory, kv]) {
      let allowed = 0;
      let last: { allowed: boolean; retryAfterSeconds?: number } = { allowed: true };
      for (let i = 0; i < MAX_AI_RUNS_PER_DAY + 5; i += 1) {
        last = (await store.consume('u1', MAX_AI_RUNS_PER_DAY, now)) as {
          allowed: boolean;
          retryAfterSeconds?: number;
        };
        if (last.allowed) allowed += 1;
      }
      expect(allowed).toBe(MAX_AI_RUNS_PER_DAY);
      expect(last.allowed).toBe(false);
    }
  });

  it('shares the allowance across isolates on the same KV namespace', async () => {
    const kv = new FakeKv();
    const firstIsolate = new KvAiQuotaStore(kv);
    const secondIsolate = new KvAiQuotaStore(kv);
    const now = 6_000_000;

    let allowedFirst = 0;
    for (let i = 0; i < MAX_AI_RUNS_PER_DAY; i += 1) {
      const decision = (await firstIsolate.consume('u1', MAX_AI_RUNS_PER_DAY, now)) as {
        allowed: boolean;
      };
      if (decision.allowed) allowedFirst += 1;
    }
    expect(allowedFirst).toBe(MAX_AI_RUNS_PER_DAY);
    // The second isolate sees the exhausted allowance.
    expect((await secondIsolate.consume('u1', MAX_AI_RUNS_PER_DAY, now + 1)).allowed).toBe(false);
  });
});
