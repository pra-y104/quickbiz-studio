import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testEnv } from './test-env';

const JWT_SECRET = 'test-secret-value-that-is-long-enough';
const secretKey = new TextEncoder().encode(JWT_SECRET);

async function signToken(expiresIn = '1h') {
  return new SignJWT({ email: 'ada@example.com', role: 'authenticated', session_id: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('demo-user-id')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

const env = () => testEnv({ SUPABASE_JWT_SECRET: JWT_SECRET });

const writerInput = {
  documentType: 'email',
  topic: 'A practical guide to opening a small bakery in Lagos',
  tone: 'friendly',
  length: 'medium',
  language: 'en',
};

function post(
  app: ReturnType<typeof createApp>,
  token: string | null,
  body: unknown,
  environment = env(),
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  return app.request(
    '/api/v1/ai/run',
    { method: 'POST', headers, body: JSON.stringify(body) },
    environment,
  );
}

describe('POST /api/v1/ai/run (M2)', () => {
  it('requires authentication', async () => {
    const app = createApp();
    const response = await post(app, null, { tool: 'ai-writer', input: writerInput });

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid token', async () => {
    const app = createApp();
    const response = await post(app, 'not-a-token', { tool: 'ai-writer', input: writerInput });

    expect(response.status).toBe(401);
  });

  it('rejects an unknown tool', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await post(app, token, { tool: 'invoice-maker', input: writerInput });

    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { code: string; details?: unknown } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid input before any provider work', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await post(app, token, { tool: 'ai-writer', input: { topic: 'short' } });

    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { details?: unknown } };
    expect(JSON.stringify(body.error.details)).toContain('topic');
  });

  it('fails closed with 503 while no adapter is registered', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await post(app, token, { tool: 'ai-writer', input: writerInput });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('fails closed even when AI_PROVIDER is set', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await post(
      app,
      token,
      { tool: 'ai-writer', input: writerInput },
      testEnv({
        SUPABASE_JWT_SECRET: JWT_SECRET,
        AI_PROVIDER: 'gemini',
        AI_MODEL: 'gemini-2.5-flash',
      }),
    );

    expect(response.status).toBe(503);
  });

  it('does not leak internal details on failure', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await post(app, token, { tool: 'ai-writer', input: writerInput });
    const text = await response.text();

    expect(text).not.toMatch(/sk-|api[_-]?key|Bearer |generativelanguage/);
  });

  it('keeps the status endpoint public and unchanged', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/ai/status', {}, env());
    const body = (await response.json()) as {
      data: { configured: boolean; reason: string; quota: null };
    };

    expect(response.status).toBe(200);
    expect(body.data.configured).toBe(false);
    expect(body.data.reason).toBe('no-adapters-registered');
    expect(body.data.quota).toBeNull();
  });
});
