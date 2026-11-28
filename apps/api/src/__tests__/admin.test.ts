import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testEnv } from './test-env';

const JWT_SECRET = 'test-secret-value-that-is-long-enough';
const secretKey = new TextEncoder().encode(JWT_SECRET);

const ADMIN_USER_ID = 'admin-user-123';
const ADMIN_EMAIL = 'owner@quickbiz.test';

async function signToken(
  options: {
    sub?: string;
    email?: string;
    role?: string;
    audience?: string;
    expiresIn?: string;
  } = {},
) {
  const {
    sub = 'demo-user-id',
    email = 'ada@example.com',
    role = 'authenticated',
    audience = 'authenticated',
    expiresIn = '1h',
  } = options;

  return new SignJWT({ email, role, session_id: 'session-1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

/** Auth + admin allow-list configured. */
const adminEnv = () =>
  testEnv({
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ADMIN_USER_IDS: ADMIN_USER_ID,
    ADMIN_EMAILS: ADMIN_EMAIL,
  });

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('admin authorization', () => {
  it('rejects requests without a token (401)', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/admin', {}, adminEnv());
    expect(response.status).toBe(401);
    expect((await response.json()) as unknown).toMatchObject({
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('forbids a signed-in non-admin (403)', async () => {
    const app = createApp();
    const token = await signToken({ sub: 'regular-user', email: 'user@example.com' });
    const response = await app.request('/api/v1/admin', { headers: authHeader(token) }, adminEnv());
    expect(response.status).toBe(403);
    expect((await response.json()) as unknown).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('forbids every admin sub-route for a non-admin (403)', async () => {
    const app = createApp();
    const token = await signToken({ sub: 'regular-user', email: 'user@example.com' });
    for (const path of [
      '/api/v1/admin/users',
      '/api/v1/admin/wallets',
      '/api/v1/admin/payments',
      '/api/v1/admin/referrals',
      '/api/v1/admin/audit-logs',
      '/api/v1/admin/tools',
      '/api/v1/admin/settings',
    ]) {
      const response = await app.request(path, { headers: authHeader(token) }, adminEnv());
      expect(response.status, path).toBe(403);
    }
  });

  it('does not grant admin from a forged role claim (cannot self-promote)', async () => {
    const app = createApp();
    // A token that claims role "admin" but is not on the server allow-list.
    const token = await signToken({
      sub: 'imposter',
      email: 'imposter@example.com',
      role: 'admin',
    });
    const response = await app.request('/api/v1/admin', { headers: authHeader(token) }, adminEnv());
    expect(response.status).toBe(403);
  });

  it('fails closed when no admin allow-list is configured', async () => {
    const app = createApp();
    const token = await signToken({ sub: ADMIN_USER_ID, email: ADMIN_EMAIL });
    // No ADMIN_USER_IDS / ADMIN_EMAILS in this env.
    const response = await app.request(
      '/api/v1/admin',
      { headers: authHeader(token) },
      testEnv({ SUPABASE_JWT_SECRET: JWT_SECRET }),
    );
    expect(response.status).toBe(403);
  });
});

describe('admin data (authorized)', () => {
  it('allows an admin matched by user id and returns a real overview', async () => {
    const app = createApp();
    const token = await signToken({ sub: ADMIN_USER_ID, email: 'whoever@example.com' });
    const response = await app.request('/api/v1/admin', { headers: authHeader(token) }, adminEnv());

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        platform: { name: string; version: string; environment: string };
        tools: { total: number; live: number; ai: number; utility: number };
        ai: { configured: boolean };
        sections: Record<string, { available: boolean }>;
      };
    };
    expect(body.data.platform.name).toBeTruthy();
    expect(body.data.tools.total).toBeGreaterThan(0);
    expect(body.data.tools.live).toBeGreaterThan(0);
    // No adapters are registered in this build, so AI is honestly unavailable.
    expect(body.data.ai.configured).toBe(false);
    // Real sections are available; DB-backed sections are not.
    expect(body.data.sections.tools?.available).toBe(true);
    expect(body.data.sections.users?.available).toBe(false);
    expect(body.data.sections.payments?.available).toBe(false);
  });

  it('allows an admin matched by email', async () => {
    const app = createApp();
    const token = await signToken({ sub: 'some-other-id', email: ADMIN_EMAIL });
    const response = await app.request(
      '/api/v1/admin/me',
      { headers: authHeader(token) },
      adminEnv(),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { email: string } };
    expect(body.data.email).toBe(ADMIN_EMAIL);
  });

  it('returns real tool data and honest unavailable states', async () => {
    const app = createApp();
    const token = await signToken({ sub: ADMIN_USER_ID });
    const toolsRes = await app.request(
      '/api/v1/admin/tools',
      { headers: authHeader(token) },
      adminEnv(),
    );
    const tools = (await toolsRes.json()) as { data: { available: boolean; total: number } };
    expect(tools.data.available).toBe(true);
    expect(tools.data.total).toBeGreaterThan(0);

    const usersRes = await app.request(
      '/api/v1/admin/users',
      { headers: authHeader(token) },
      adminEnv(),
    );
    expect(usersRes.status).toBe(200);
    expect((await usersRes.json()) as unknown).toMatchObject({
      data: { available: false },
    });
  });

  it('exposes read-only settings without secrets', async () => {
    const app = createApp();
    const token = await signToken({ sub: ADMIN_USER_ID });
    const response = await app.request(
      '/api/v1/admin/settings',
      { headers: authHeader(token) },
      adminEnv(),
    );
    expect(response.status).toBe(200);
    const raw = await response.text();
    // Never leak secrets in the settings payload.
    expect(raw).not.toContain(JWT_SECRET);
    const body = JSON.parse(raw) as {
      data: { editable: boolean; values: Record<string, unknown> };
    };
    expect(body.data.editable).toBe(false);
    expect(body.data.values).not.toHaveProperty('serviceRoleKey');
  });
});
