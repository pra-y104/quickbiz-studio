import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testEnv } from './test-env';

const JWT_SECRET = 'test-secret-value-that-is-long-enough';
const PAYSTACK_SECRET = 'sk_test_0123456789abcdef';
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

function hexHmac(secret: string, payload: string): Promise<string> {
  return crypto.subtle
    .importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ])
    .then((key) => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
    .then((buffer) =>
      [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    );
}

const envNoProvider = () => testEnv({ SUPABASE_JWT_SECRET: JWT_SECRET });
const envWithProvider = () =>
  testEnv({ SUPABASE_JWT_SECRET: JWT_SECRET, PAYSTACK_SECRET_KEY: PAYSTACK_SECRET });

describe('payment routes', () => {
  it('reports no provider configured by default', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/payments/status', {}, envNoProvider());
    const body = (await response.json()) as { data: { configured: boolean; mode: string | null } };
    expect(response.status).toBe(200);
    expect(body.data.configured).toBe(false);
    expect(body.data.mode).toBeNull();
  });

  it('reports test mode when a test key is present', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/payments/status', {}, envWithProvider());
    const body = (await response.json()) as { data: { configured: boolean; mode: string | null } };
    expect(body.data.configured).toBe(true);
    expect(body.data.mode).toBe('test');
  });

  it('requires authentication to start a checkout', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/payments/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountMinor: 250_000, currency: 'NGN', email: 'a@b.com' }),
      },
      envWithProvider(),
    );
    expect(response.status).toBe(401);
  });

  it('fails closed with 503 when no provider is configured', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountMinor: 250_000, currency: 'NGN', email: 'a@b.com' }),
      },
      envNoProvider(),
    );
    expect(response.status).toBe(503);
  });

  it('rejects a webhook with an invalid signature', async () => {
    const app = createApp();
    const raw = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'qb_1', status: 'success' },
    });
    const response = await app.request(
      '/api/v1/payments/webhook',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-paystack-signature': 'deadbeef' },
        body: raw,
      },
      envWithProvider(),
    );
    expect(response.status).toBe(400);
  });

  it('acknowledges a correctly signed webhook', async () => {
    const app = createApp();
    const raw = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'qb_1', status: 'success', amount: 250_000, currency: 'NGN' },
    });
    const signature = await hexHmac(PAYSTACK_SECRET, raw);
    const response = await app.request(
      '/api/v1/payments/webhook',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-paystack-signature': signature },
        body: raw,
      },
      envWithProvider(),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { received: boolean } };
    expect(body.data.received).toBe(true);
  });
});
