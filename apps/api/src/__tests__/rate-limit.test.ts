import { describe, expect, it } from 'vitest';
import {
  InMemoryRateLimitStore,
  KvRateLimitStore,
  rateLimitKey,
  type KvLike,
} from '../middleware/rate-limit-store';
import { createRateLimit } from '../middleware/rate-limit';
import { testEnv } from './test-env';
import type { AppContext } from '../types/context';
import { Hono } from 'hono';
import { errorHandler } from '../middleware/error-handler';
import { requestContext } from '../middleware/request-context';
import { createCors } from '../middleware/cors';
import { securityHeaders } from '../middleware/security-headers';

/** In-memory fake of the subset of KV the store uses. */
class FakeKv implements KvLike {
  readonly data = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
}

describe('rate limit store', () => {
  it('allows up to the limit then blocks within a window', async () => {
    const store = new InMemoryRateLimitStore();
    const key = rateLimitKey({ clientKey: '1.2.3.4', path: '/api/v1/ai/run' });
    const now = 1_000_000;
    const windowMs = 60_000;

    const first = await store.hit(key, 3, windowMs, now);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    await store.hit(key, 3, windowMs, now + 10);
    const third = await store.hit(key, 3, windowMs, now + 20);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = await store.hit(key, 3, windowMs, now + 30);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // After the window elapses, the counter resets.
    const reset = await store.hit(key, 3, windowMs, now + windowMs + 1);
    expect(reset.allowed).toBe(true);
  });

  it('isolates keys per client and path', async () => {
    const store = new InMemoryRateLimitStore();
    const a = rateLimitKey({ clientKey: '1.1.1.1', path: '/api/v1/tools' });
    const b = rateLimitKey({ clientKey: '2.2.2.2', path: '/api/v1/tools' });
    const c = rateLimitKey({ clientKey: '1.1.1.1', path: '/api/v1/ai/run' });

    await store.hit(a, 1, 60_000, 0);
    expect((await store.hit(a, 1, 60_000, 1)).allowed).toBe(false);
    expect((await store.hit(b, 1, 60_000, 1)).allowed).toBe(true);
    expect((await store.hit(c, 1, 60_000, 1)).allowed).toBe(true);
  });

  it('KV store shares state across instances backed by the same namespace', async () => {
    const kv = new FakeKv();
    const storeA = new KvRateLimitStore(kv);
    const storeB = new KvRateLimitStore(kv);
    const key = rateLimitKey({ clientKey: '9.9.9.9', path: '/api/v1/ai/run' });

    expect((await storeA.hit(key, 2, 60_000, 0)).allowed).toBe(true);
    // A different store instance (a different isolate) sees the shared counter.
    expect((await storeB.hit(key, 2, 60_000, 1)).allowed).toBe(true);
    expect((await storeB.hit(key, 2, 60_000, 2)).allowed).toBe(false);
  });

  it('KV store expires entries after the window', async () => {
    const kv = new FakeKv();
    const store = new KvRateLimitStore(kv);
    const key = rateLimitKey({ clientKey: '8.8.8.8', path: '/api/v1/tools' });

    await store.hit(key, 1, 1000, 0);
    expect(await store.peek(key, 500)).toBe(1);
    // Past resetAt, peek reports 0 and a new hit is allowed.
    expect(await store.peek(key, 2000)).toBe(0);
    expect((await store.hit(key, 1, 1000, 2000)).allowed).toBe(true);
  });
});

describe('rate limit middleware', () => {
  function build(store: InMemoryRateLimitStore): Hono<AppContext> {
    const app = new Hono<AppContext>();
    app.onError(errorHandler);
    app.use('*', requestContext);
    app.use('*', async (c, next) => createCors(c.get('config'))(c, next));
    app.use('*', securityHeaders);
    app.use('*', createRateLimit(store));
    app.get('/api/v1/tools', (c) => c.json({ ok: true }));
    return app;
  }

  it('returns 429 with Retry-After once the limit is exceeded', async () => {
    const store = new InMemoryRateLimitStore();
    const app = build(store);
    const env = testEnv({ RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_MAX_REQUESTS: '2' });
    const headers = { 'cf-connecting-ip': '5.5.5.5' };

    const first = await app.request('/api/v1/tools', { headers }, env);
    expect(first.status).toBe(200);
    expect(first.headers.get('x-ratelimit-remaining')).toBe('1');

    await app.request('/api/v1/tools', { headers }, env);
    const blocked = await app.request('/api/v1/tools', { headers }, env);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });

  it('uses a shared store when injected so limits hold across requests', async () => {
    // A KV-backed store means the counter survives beyond a single in-memory map.
    const kv = new FakeKv();
    const store = new KvRateLimitStore(kv);
    const app = build(store as unknown as InMemoryRateLimitStore);
    const env = testEnv({ RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_MAX_REQUESTS: '1' });
    const headers = { 'cf-connecting-ip': '6.6.6.6' };

    expect((await app.request('/api/v1/tools', { headers }, env)).status).toBe(200);
    expect((await app.request('/api/v1/tools', { headers }, env)).status).toBe(429);
  });
});
