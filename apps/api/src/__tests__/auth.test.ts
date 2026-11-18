import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testEnv } from './test-env';

const JWT_SECRET = 'test-secret-value-that-is-long-enough';
const secretKey = new TextEncoder().encode(JWT_SECRET);

async function signToken(
  options: {
    sub?: string;
    email?: string;
    audience?: string;
    expiresIn?: string;
    secret?: Uint8Array;
  } = {},
) {
  const {
    sub = 'demo-user-id',
    email = 'ada@example.com',
    audience = 'authenticated',
    expiresIn = '1h',
    secret = secretKey,
  } = options;

  return new SignJWT({ email, role: 'authenticated', session_id: 'session-1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

const authEnv = () => testEnv({ SUPABASE_JWT_SECRET: JWT_SECRET });

describe('GET /api/v1/me', () => {
  it('returns the identity from a valid access token', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/me',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      authEnv(),
    );

    const body = (await response.json()) as {
      data: { id: string; email: string; role: string; expiresAt: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe('demo-user-id');
    expect(body.data.email).toBe('ada@example.com');
    expect(body.data.role).toBe('authenticated');
    expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('ignores a user id supplied by the caller', async () => {
    const app = createApp();
    const token = await signToken({ sub: 'real-user' });
    const response = await app.request(
      '/api/v1/me?userId=attacker',
      {
        headers: { Authorization: `Bearer ${token}`, 'X-User-Id': 'attacker' },
      },
      authEnv(),
    );

    const body = (await response.json()) as { data: { id: string } };
    expect(body.data.id).toBe('real-user');
  });

  it('rejects requests without a token', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/me', {}, authEnv());
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(response.headers.get('www-authenticate')).toContain('Bearer');
  });

  it('rejects malformed, wrongly signed and wrongly scoped tokens', async () => {
    const app = createApp();
    const wrongSecret = new TextEncoder().encode('a-different-secret-value-here');
    const tokens = [
      'not-a-jwt',
      await signToken({ secret: wrongSecret }),
      await signToken({ audience: 'anon' }),
    ];

    for (const token of tokens) {
      const response = await app.request(
        '/api/v1/me',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        authEnv(),
      );
      expect(response.status).toBe(401);
    }
  });

  it('rejects expired tokens with a session message', async () => {
    const app = createApp();
    const token = await signToken({ expiresIn: '-60s' });
    const response = await app.request(
      '/api/v1/me',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      authEnv(),
    );
    const body = (await response.json()) as { error: { message: string } };

    expect(response.status).toBe(401);
    expect(body.error.message).toMatch(/session has ended/i);
  });

  it('fails closed when the server has no auth configuration', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/me',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      testEnv(),
    );

    expect(response.status).toBe(503);
    expect((await response.json()) as unknown).toMatchObject({
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
