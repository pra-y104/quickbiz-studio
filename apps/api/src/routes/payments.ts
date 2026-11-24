/**
 * Payment routes.
 *
 * Provider-neutral over the `PaymentProvider` contract:
 *
 * - `GET /status` reports whether a provider is configured (never a key).
 * - `POST /checkout` is authenticated and fails closed with 503 when no provider
 *   is configured; it returns the provider's authorisation URL, never opened here.
 * - `GET /verify/:reference` is authenticated and asks the provider for the truth,
 *   then confirms amount and currency against the stored checkout request.
 * - `POST /webhook` is unauthenticated but signature-verified. It credits nothing
 *   without a database (Stage 7 persistence); it validates the signature, checks
 *   the amount, and acknowledges. Reconciliation into the wallet is a documented
 *   follow-up that requires the migration to be applied.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { parseOrThrow } from '../lib/validate';
import { ok } from '../lib/response';
import { PaymentProviderError } from '../payments/provider';
import { resolvePaymentProvider } from '../payments/registry';
import { defaultPaymentLedger } from '../payments/ledger';
import type { AppContext } from '../types/context';

export const paymentRoutes = new Hono<AppContext>();

function mapProviderError(error: PaymentProviderError): AppError {
  switch (error.code) {
    case 'invalid-signature':
      return AppError.badRequest('The payment signature could not be verified.');
    case 'amount-mismatch':
      return AppError.badRequest('The payment amount did not match.');
    case 'not-found':
      return AppError.notFound('That payment could not be found.');
    case 'unconfigured':
      return AppError.unavailable('Payments are not available in this build.');
    default:
      return AppError.provider();
  }
}

paymentRoutes.get('/status', (c) => {
  const provider = resolvePaymentProvider(c.env);
  return ok(c, {
    configured: provider !== null,
    provider: provider?.id ?? null,
    // Test mode is the only mode this build supports.
    mode: provider ? 'test' : null,
    // False until the payment migration is applied and a service-role ledger is
    // wired; a webhook is acknowledged but never settles money without it.
    ledgerConfigured: defaultPaymentLedger.isConfigured(),
  });
});

const checkoutBodySchema = z
  .object({
    amountMinor: z.number().int().positive().max(100_000_000),
    currency: z.string().regex(/^[A-Z]{3}$/),
    email: z.string().email(),
    reference: z.string().min(1).max(120).optional(),
    callbackUrl: z.string().url().optional(),
  })
  .strict();

paymentRoutes.post('/checkout', async (c) => {
  await requireAuth(c, async () => undefined);
  const provider = resolvePaymentProvider(c.env);
  if (!provider) throw AppError.unavailable('Payments are not available in this build.');

  const body = parseOrThrow(checkoutBodySchema, await c.req.json().catch(() => null));
  const reference = body.reference ?? `qb_${crypto.randomUUID()}`;
  const callbackUrl =
    body.callbackUrl ?? `${new URL(c.req.url).origin}/wallet?reference=${reference}`;

  try {
    const session = await provider.initialise({
      reference,
      amountMinor: body.amountMinor,
      currency: body.currency,
      email: body.email,
      callbackUrl,
    });
    logger.info('payments.checkout.created', { requestId: c.get('requestId'), reference });
    return ok(c, {
      reference: session.reference,
      authorizationUrl: session.authorizationUrl,
      amountMinor: session.amountMinor,
      currency: session.currency,
    });
  } catch (error) {
    if (error instanceof PaymentProviderError) throw mapProviderError(error);
    throw AppError.provider();
  }
});

paymentRoutes.get('/verify/:reference', async (c) => {
  await requireAuth(c, async () => undefined);
  const provider = resolvePaymentProvider(c.env);
  if (!provider) throw AppError.unavailable('Payments are not available in this build.');

  const reference = c.req.param('reference');
  try {
    const verification = await provider.verify(reference);
    return ok(c, verification);
  } catch (error) {
    if (error instanceof PaymentProviderError) throw mapProviderError(error);
    throw AppError.provider();
  }
});

paymentRoutes.post('/webhook', async (c) => {
  const provider = resolvePaymentProvider(c.env);
  if (!provider) throw AppError.unavailable('Payments are not available in this build.');

  const rawBody = await c.req.text();
  const signature = c.req.header('x-paystack-signature') ?? c.req.header('x-signature') ?? null;

  try {
    const event = await provider.verifyWebhook({ rawBody, signature });
    if (!event) {
      // Unrelated event or unparseable body: acknowledge so the provider stops retrying.
      return ok(c, { received: true, ignored: true });
    }

    // Store the event for replay protection, then settle once if it is new.
    // With no ledger configured (this build) the event is acknowledged and no
    // money moves; see supabase/migrations/0005_payments.sql for the service-role
    // functions (payment_store_event, payment_settle) that implement this.
    const recorded = await defaultPaymentLedger.recordEvent({
      provider: event.providerId,
      providerEventId: c.req.header('x-paystack-signature') ?? 'body-hash',
      type: event.type,
      reference: event.reference,
      status: event.status,
      payload: event.payload,
    });

    if (!recorded.duplicate && event.status === 'success') {
      await defaultPaymentLedger.settle(event.reference);
    }

    logger.info('payments.webhook.received', {
      requestId: c.get('requestId'),
      type: event.type,
      reference: event.reference,
      status: event.status,
      duplicate: recorded.duplicate,
      settled: defaultPaymentLedger.isConfigured(),
    });
    return ok(c, { received: true, duplicate: recorded.duplicate });
  } catch (error) {
    if (error instanceof PaymentProviderError) throw mapProviderError(error);
    throw AppError.provider();
  }
});

const refundBodySchema = z
  .object({
    reference: z.string().min(1).max(120),
    amountMinor: z.number().int().positive().max(100_000_000),
    reason: z.string().min(1).max(500).optional(),
  })
  .strict();

paymentRoutes.post('/refund', async (c) => {
  await requireAuth(c, async () => undefined);
  const provider = resolvePaymentProvider(c.env);
  if (!provider) throw AppError.unavailable('Payments are not available in this build.');

  const body = parseOrThrow(refundBodySchema, await c.req.json().catch(() => null));

  try {
    const result = await provider.refund({
      reference: body.reference,
      amountMinor: body.amountMinor,
      reason: body.reason,
    });
    logger.info('payments.refund.created', {
      requestId: c.get('requestId'),
      reference: body.reference,
      amountMinor: body.amountMinor,
      status: result.status,
    });
    return ok(c, result);
  } catch (error) {
    if (error instanceof PaymentProviderError) throw mapProviderError(error);
    throw AppError.provider();
  }
});
