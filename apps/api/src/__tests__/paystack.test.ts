import { describe, expect, it } from 'vitest';
import { createPaystackProvider } from '../payments/paystack';
import { PaymentProviderError } from '../payments/provider';

const SECRET = 'sk_test_0123456789abcdef';
const BASE = 'https://paystack.test';

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

interface FakeCall {
  url: string;
  init: RequestInit;
}

function fakeFetch(handler: (call: FakeCall) => unknown, ok = true) {
  const calls: FakeCall[] = [];
  const impl = async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, init: init ?? {} });
    const data = handler({ url: input, init: init ?? {} });
    return new Response(JSON.stringify(data), {
      status: ok ? 200 : 400,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { impl, calls };
}

const checkout = {
  reference: 'qb_1',
  amountMinor: 250_000,
  currency: 'NGN',
  email: 'ada@example.com',
  callbackUrl: 'https://quickbiz.test/return',
};

describe('Paystack adapter (test mode, no real network)', () => {
  it('is configured only for a test-mode key', () => {
    expect(createPaystackProvider({ secretKey: null }).isConfigured()).toBe(false);
    expect(createPaystackProvider({ secretKey: 'sk_live_secret' }).isConfigured()).toBe(false);
    expect(createPaystackProvider({ secretKey: SECRET }).isConfigured()).toBe(true);
  });

  it('refuses live keys and missing keys at call time', async () => {
    const live = createPaystackProvider({ secretKey: 'sk_live_x', baseUrl: BASE });
    await expect(live.initialise(checkout)).rejects.toMatchObject({
      code: 'unconfigured',
    });
  });

  it('initialises a checkout with amount in minor units', async () => {
    const { impl, calls } = fakeFetch(() => ({
      data: { authorization_url: 'https://paystack.test/checkout/qb_1', reference: 'qb_1' },
    }));
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE }, impl);
    const session = await provider.initialise(checkout);

    expect(session.authorizationUrl).toBe('https://paystack.test/checkout/qb_1');
    expect(session.reference).toBe('qb_1');
    expect(calls[0]!.url).toBe(`${BASE}/transaction/initialize`);
    const sent = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(sent.amount).toBe(250_000);
    expect(sent.currency).toBe('NGN');
    expect(calls[0]!.init.headers).toMatchObject({ Authorization: `Bearer ${SECRET}` });
  });

  it('verifies a transaction and maps status/amount', async () => {
    const { impl } = fakeFetch(() => ({
      data: {
        status: 'success',
        amount: 250_000,
        currency: 'NGN',
        paid_at: '2026-01-01T00:00:00Z',
      },
    }));
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE }, impl);
    const verification = await provider.verify('qb_1');

    expect(verification.status).toBe('success');
    expect(verification.amountMinor).toBe(250_000);
    expect(verification.currency).toBe('NGN');
  });

  it('rejects a webhook with an invalid signature without leaking the secret', async () => {
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE });
    const raw = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'qb_1', status: 'success' },
    });
    await expect(
      provider.verifyWebhook({ rawBody: raw, signature: 'deadbeef' }),
    ).rejects.toMatchObject({ code: 'invalid-signature' });
  });

  it('accepts a correctly signed charge.success webhook', async () => {
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE });
    const raw = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'qb_1', status: 'success', amount: 250_000, currency: 'NGN' },
    });
    const signature = await hexHmac(SECRET, raw);
    const event = await provider.verifyWebhook({ rawBody: raw, signature });

    expect(event?.reference).toBe('qb_1');
    expect(event?.status).toBe('success');
  });

  it('ignores unrelated webhook events', async () => {
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE });
    const raw = JSON.stringify({ event: 'transfer.success', data: { reference: 'qb_1' } });
    const signature = await hexHmac(SECRET, raw);
    expect(await provider.verifyWebhook({ rawBody: raw, signature })).toBeNull();
  });

  it('surfaces a provider error without the raw body', async () => {
    const { impl } = fakeFetch(() => ({ message: 'Invalid key' }), false);
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE }, impl);
    await expect(provider.initialise(checkout)).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it('refund verifies the transaction, then returns the provider refund id and success', async () => {
    const { impl, calls } = fakeFetch((call) => {
      if (call.url.includes('/transaction/verify/')) {
        return { data: { status: 'success', amount: 250_000, currency: 'NGN' } };
      }
      // POST /refund
      return { data: { id: 987654, status: 'success' } };
    });
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE }, impl);

    const result = await provider.refund({ reference: 'qb_1', amountMinor: 250_000 });

    expect(result.status).toBe('success');
    expect(result.refundReference).toBe('987654');
    expect(result.amountMinor).toBe(250_000);
    // It verified the transaction before refunding.
    expect(calls[0]!.url).toBe(`${BASE}/transaction/verify/qb_1`);
    expect(calls[1]!.url).toBe(`${BASE}/refund`);
  });

  it('refund refuses a transaction that is not successful', async () => {
    const { impl } = fakeFetch(() => ({
      data: { status: 'failed', amount: 250_000, currency: 'NGN' },
    }));
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE }, impl);

    await expect(
      provider.refund({ reference: 'qb_1', amountMinor: 250_000 }),
    ).rejects.toMatchObject({ code: 'provider' });
  });

  it('refund refuses an amount greater than the captured amount', async () => {
    const { impl } = fakeFetch(() => ({
      data: { status: 'success', amount: 250_000, currency: 'NGN' },
    }));
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE }, impl);

    await expect(
      provider.refund({ reference: 'qb_1', amountMinor: 300_000 }),
    ).rejects.toMatchObject({ code: 'amount-mismatch' });
  });

  it('refund maps a non-success provider response to pending (never recorded as success)', async () => {
    const { impl } = fakeFetch((call) => {
      if (call.url.includes('/transaction/verify/')) {
        return { data: { status: 'success', amount: 250_000, currency: 'NGN' } };
      }
      return { data: { id: 111, status: 'pending' } };
    });
    const provider = createPaystackProvider({ secretKey: SECRET, baseUrl: BASE }, impl);

    const result = await provider.refund({ reference: 'qb_1', amountMinor: 250_000 });
    expect(result.status).toBe('pending');
    expect(result.refundReference).toBe('111');
  });
});
