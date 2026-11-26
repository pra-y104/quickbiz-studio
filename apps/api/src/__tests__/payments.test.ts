import { describe, expect, it } from 'vitest';
import { createSimulatedPaymentProvider } from '../payments/simulated';
import { PaymentProviderError } from '../payments/provider';
import { verifySignature } from '../payments/signature';

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

const SECRET = 'sk_test_0123456789abcdef';

const checkout = {
  reference: 'qb_1001',
  amountMinor: 250_000,
  currency: 'NGN',
  email: 'ada@example.com',
  callbackUrl: 'https://quickbiz.example/return',
};

describe('payment provider (simulated, no network)', () => {
  it('creates a checkout without contacting anyone', async () => {
    const provider = createSimulatedPaymentProvider();
    const session = await provider.initialise(checkout);

    expect(session.reference).toBe('qb_1001');
    expect(session.amountMinor).toBe(250_000);
    expect(session.authorizationUrl).toContain('qb_1001');
  });

  it('reports pending until the gateway confirms', async () => {
    const provider = createSimulatedPaymentProvider();
    await provider.initialise(checkout);

    expect((await provider.verify('qb_1001')).status).toBe('pending');

    provider.markPaid('qb_1001');
    const paid = await provider.verify('qb_1001');
    expect(paid.status).toBe('success');
    expect(paid.paidAt).toBeTruthy();
  });

  it('refuses to verify an unknown reference', async () => {
    const provider = createSimulatedPaymentProvider();
    await expect(provider.verify('nope')).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it('accepts a correctly signed webhook', async () => {
    const provider = createSimulatedPaymentProvider();
    await provider.initialise(checkout);
    provider.markPaid('qb_1001');

    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'qb_1001', status: 'success' },
    });

    const signature = await hexHmac(SECRET, body);
    const event = await provider.verifyWebhook({ rawBody: body, signature });

    expect(event?.type).toBe('charge.success');
    expect(event?.status).toBe('success');
    expect(event?.amountMinor).toBe(250_000);
  });

  it('ignores an unrelated event', async () => {
    const provider = createSimulatedPaymentProvider();
    await provider.initialise(checkout);

    const body = JSON.stringify({ event: 'transfer.success', data: { reference: 'qb_1001' } });
    expect(await provider.verifyWebhook({ rawBody: body, signature: '00' })).toBeNull();
  });

  it('refunds only a paid transaction and never more than captured', async () => {
    const provider = createSimulatedPaymentProvider();
    await provider.initialise(checkout);

    await expect(
      provider.refund({ reference: 'qb_1001', amountMinor: 1_000 }),
    ).rejects.toBeInstanceOf(PaymentProviderError);

    provider.markPaid('qb_1001');
    await expect(
      provider.refund({ reference: 'qb_1001', amountMinor: 300_000 }),
    ).rejects.toBeInstanceOf(PaymentProviderError);

    const refund = await provider.refund({ reference: 'qb_1001', amountMinor: 50_000 });
    expect(refund.status).toBe('success');
    // The provider's own refund id is returned so the caller can record it.
    expect(refund.refundReference).toBe('sim_refund_qb_1001');
    expect(refund.amountMinor).toBe(50_000);
  });
});

describe('webhook signature verification', () => {
  it('accepts a valid hex signature', async () => {
    const signature = await hexHmac(SECRET, '{"a":1}');
    await expect(
      verifySignature({ secret: SECRET, rawBody: '{"a":1}', signature }),
    ).resolves.toEqual({ valid: true });
  });

  it('rejects a missing signature', async () => {
    await expect(
      verifySignature({ secret: SECRET, rawBody: '{}', signature: null }),
    ).resolves.toEqual({ valid: false, reason: 'missing' });
  });

  it('rejects a malformed signature', async () => {
    await expect(
      verifySignature({ secret: SECRET, rawBody: '{}', signature: 'zzzz' }),
    ).resolves.toEqual({ valid: false, reason: 'malformed' });
  });

  it('rejects a tampered body', async () => {
    const signature = await hexHmac(SECRET, '{"amount":100}');
    await expect(
      verifySignature({ secret: SECRET, rawBody: '{"amount":999}', signature }),
    ).resolves.toEqual({ valid: false, reason: 'mismatch' });
  });

  it('rejects a stale timestamped signature (replay protection)', async () => {
    const now = 1_700_000_000_000;
    const timestamp = Math.floor(now / 1000) - 10_000;
    const signature = await hexHmac(SECRET, `${timestamp}.{"a":1}`);

    await expect(
      verifySignature({
        secret: SECRET,
        rawBody: '{"a":1}',
        signature: `t=${timestamp},v1=${signature}`,
        now,
      }),
    ).resolves.toEqual({ valid: false, reason: 'stale' });
  });

  it('accepts a fresh timestamped signature', async () => {
    const now = 1_700_000_000_000;
    const timestamp = Math.floor(now / 1000);
    const signature = await hexHmac(SECRET, `${timestamp}.{"a":1}`);

    await expect(
      verifySignature({
        secret: SECRET,
        rawBody: '{"a":1}',
        signature: `t=${timestamp},v1=${signature}`,
        now,
      }),
    ).resolves.toEqual({ valid: true });
  });

  it('does not include the secret in any error message', async () => {
    const result = await verifySignature({
      secret: SECRET,
      rawBody: '{}',
      signature: '00',
    }).catch((error: unknown) => error);

    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});
