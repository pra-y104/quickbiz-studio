/**
 * Refund route tests.
 *
 * The `/refund` route is the security boundary for external refunds. These tests
 * exercise it with a mocked ledger and provider so the authorisation, validation
 * and "record only on confirmed provider success" rules are verified without a
 * database or network. The real SQL behaviour is covered separately by the
 * PostgreSQL integration harness (supabase/tests).
 */

import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { PaymentProviderError } from '../payments/provider';
import { testEnv } from './test-env';

const JWT_SECRET = 'test-secret-value-that-is-long-enough';
const secretKey = new TextEncoder().encode(JWT_SECRET);

const mocks = vi.hoisted(() => ({
  isConfigured: vi.fn(),
  getPayment: vi.fn(),
  recordRefund: vi.fn(),
  refund: vi.fn(),
}));

vi.mock('../payments/ledger', () => ({
  defaultPaymentLedger: {
    id: 'test-ledger',
    isConfigured: () => mocks.isConfigured(),
    recordEvent: vi.fn(async () => ({ duplicate: false })),
    settle: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    getPayment: (reference: string) => mocks.getPayment(reference),
    recordRefund: (input: unknown) => mocks.recordRefund(input),
  },
}));

vi.mock('../payments/registry', () => ({
  resolvePaymentProvider: () => ({
    id: 'paystack',
    label: 'Paystack (test mode)',
    isConfigured: () => true,
    initialise: vi.fn(),
    verify: vi.fn(),
    verifyWebhook: vi.fn(),
    refund: (request: unknown) => mocks.refund(request),
  }),
}));

async function signToken(subject = 'demo-user-id'): Promise<string> {
  return new SignJWT({ email: 'ada@example.com', role: 'authenticated', email_verified: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey);
}

const env = () => testEnv({ SUPABASE_JWT_SECRET: JWT_SECRET });

function refundRequest(token: string, body: Record<string, unknown>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  };
}

const ownedPayment = {
  reference: 'qb_1',
  userId: 'demo-user-id',
  status: 'success',
  amountMinor: 250_000,
  currency: 'NGN',
};

describe('POST /refund', () => {
  beforeEach(() => {
    mocks.isConfigured.mockReset().mockReturnValue(true);
    mocks.getPayment.mockReset().mockResolvedValue(ownedPayment);
    mocks.recordRefund.mockReset().mockResolvedValue(undefined);
    mocks.refund.mockReset();
  });

  it('requires authentication', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/payments/refund',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference: 'qb_1', amountMinor: 250_000 }),
      },
      env(),
    );
    expect(response.status).toBe(401);
  });

  it('fails closed with 503 when the ledger is not configured', async () => {
    mocks.isConfigured.mockReturnValue(false);
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_1', amountMinor: 250_000 }),
      env(),
    );
    expect(response.status).toBe(503);
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.recordRefund).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown payment', async () => {
    mocks.getPayment.mockResolvedValue(null);
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_missing', amountMinor: 250_000 }),
      env(),
    );
    expect(response.status).toBe(404);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("forbids refunding another user's payment", async () => {
    mocks.getPayment.mockResolvedValue({ ...ownedPayment, userId: 'someone-else' });
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_1', amountMinor: 250_000 }),
      env(),
    );
    expect(response.status).toBe(403);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it('rejects a payment that is not successful', async () => {
    mocks.getPayment.mockResolvedValue({ ...ownedPayment, status: 'pending' });
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_1', amountMinor: 250_000 }),
      env(),
    );
    expect(response.status).toBe(400);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it('rejects a partial refund (amount must equal the captured amount)', async () => {
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_1', amountMinor: 100_000 }),
      env(),
    );
    expect(response.status).toBe(400);
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.recordRefund).not.toHaveBeenCalled();
  });

  it('records the refund only after the provider confirms success', async () => {
    mocks.refund.mockResolvedValue({
      providerId: 'paystack',
      reference: 'qb_1',
      amountMinor: 250_000,
      refundReference: 'paystack_refund_1',
      status: 'success',
    });
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_1', amountMinor: 250_000 }),
      env(),
    );
    expect(response.status).toBe(200);
    expect(mocks.recordRefund).toHaveBeenCalledTimes(1);
    expect(mocks.recordRefund).toHaveBeenCalledWith({
      reference: 'qb_1',
      refundReference: 'paystack_refund_1',
      amountMinor: 250_000,
    });
  });

  it('does not record the refund when the provider response is pending', async () => {
    mocks.refund.mockResolvedValue({
      providerId: 'paystack',
      reference: 'qb_1',
      amountMinor: 250_000,
      refundReference: 'paystack_refund_1',
      status: 'pending',
    });
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_1', amountMinor: 250_000 }),
      env(),
    );
    expect(response.status).toBe(200);
    expect(mocks.recordRefund).not.toHaveBeenCalled();
  });

  it('does not record the refund when the provider response is failed', async () => {
    mocks.refund.mockResolvedValue({
      providerId: 'paystack',
      reference: 'qb_1',
      amountMinor: 250_000,
      status: 'failed',
    });
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_1', amountMinor: 250_000 }),
      env(),
    );
    expect(response.status).toBe(200);
    expect(mocks.recordRefund).not.toHaveBeenCalled();
  });

  it('maps a provider amount-mismatch to 400 without recording', async () => {
    mocks.refund.mockRejectedValue(
      new PaymentProviderError('amount-mismatch', 'Refund exceeds the captured amount.'),
    );
    const app = createApp();
    const token = await signToken();
    const response = await app.request(
      '/api/v1/payments/refund',
      refundRequest(token, { reference: 'qb_1', amountMinor: 250_000 }),
      env(),
    );
    expect(response.status).toBe(400);
    expect(mocks.recordRefund).not.toHaveBeenCalled();
  });
});
