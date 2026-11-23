import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testEnv } from './test-env';

const JWT_SECRET = 'test-secret-value-that-is-long-enough';
const secretKey = new TextEncoder().encode(JWT_SECRET);

async function signToken(): Promise<string> {
  return new SignJWT({ email: 'ada@example.com', role: 'authenticated', email_verified: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('demo-user-id')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey);
}

const env = () => testEnv({ SUPABASE_JWT_SECRET: JWT_SECRET });

function post(app: ReturnType<typeof createApp>, token: string | null, body: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return app.request(
    '/api/v1/translate',
    { method: 'POST', headers, body: JSON.stringify(body) },
    env(),
  );
}

describe('POST /api/v1/translate', () => {
  it('requires authentication', async () => {
    const app = createApp();
    const response = await post(app, null, { text: 'hello', target: 'yo' });
    expect(response.status).toBe(401);
  });

  it('rejects an unsupported target language', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await post(app, token, { text: 'hello', target: 'xx' });
    expect(response.status).toBe(422);
  });

  it('rejects an empty text', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await post(app, token, { text: '   ', target: 'yo' });
    expect(response.status).toBe(422);
  });

  it('fails closed with 503 because no provider is registered', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await post(app, token, { text: 'hello', target: 'yo' });
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
