import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createApp } from '../app';
import { errorHandler } from '../middleware/error-handler';
import { AppError } from '../lib/errors';
import { testEnv } from './test-env';
import type { AppContext } from '../types/context';

describe('security middleware', () => {
  it('sets hardening headers on every response', async () => {
    const app = createApp();
    const response = await app.request('/health', {}, testEnv());

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('allows configured origins and ignores unknown ones', async () => {
    const app = createApp();

    const allowed = await app.request(
      '/health',
      { headers: { Origin: 'http://localhost:5173' } },
      testEnv(),
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const blocked = await app.request(
      '/health',
      { headers: { Origin: 'https://evil.example' } },
      testEnv(),
    );
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers preflight requests without hitting handlers', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/tools',
      { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } },
      testEnv(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('returns a 404 envelope for unknown endpoints', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/does-not-exist', {}, testEnv());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('rate limits repeated requests per client', async () => {
    const app = createApp();
    const env = testEnv({ RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_MAX_REQUESTS: '2' });

    const first = await app.request('/api/v1/meta', {}, env);
    const second = await app.request('/api/v1/meta', {}, env);
    const third = await app.request('/api/v1/meta', {}, env);
    const body = (await third.json()) as { error: { code: string } };

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(third.headers.get('retry-after')).not.toBeNull();
  });

  it('never leaks internal error details to clients', async () => {
    const app = new Hono<AppContext>();
    app.onError(errorHandler);
    app.get('/boom', () => {
      throw new Error('database password is hunter2');
    });
    app.get('/guarded', () => {
      throw AppError.forbidden();
    });

    const boom = await app.request('/boom');
    const boomBody = (await boom.json()) as { error: { message: string } };
    expect(boom.status).toBe(500);
    expect(boomBody.error.message).toBe('Something went wrong on our side.');
    expect(JSON.stringify(boomBody)).not.toContain('hunter2');

    const guarded = await app.request('/guarded');
    expect(guarded.status).toBe(403);
  });
});
