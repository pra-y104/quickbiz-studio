/**
 * Paystack payment adapter.
 *
 * This maps the provider-neutral `PaymentProvider` contract onto Paystack's REST
 * API shape so the rest of the application never depends on Paystack field names.
 *
 * Safety posture:
 *   * **Test mode only.** `isConfigured()` is true solely for an `sk_test_` secret.
 *     An `sk_live_` key is rejected here on purpose: live payments require explicit
 *     owner approval and are out of scope for a zero-budget build.
 *   * **No network in tests.** Every call takes an injectable `fetch`, so the
 *     adapter is fully tested against a fake without touching Paystack.
 *   * **Amounts are integer minor units** (kobo for NGN), exactly what Paystack
 *     expects, and every response is checked against the checkout request.
 *   * **Secrets never logged or returned.** Only the provider id and reference
 *     appear in results.
 */

import {
  assertAmountMatches,
  PaymentProviderError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentProvider,
  type PaymentVerification,
  type PaymentStatus,
  type RefundRequest,
  type RefundResult,
  type WebhookEvent,
} from './provider';
import { verifySignature } from './signature';

export interface PaystackConfig {
  /** Paystack secret key. Only `sk_test_` is accepted by this adapter. */
  readonly secretKey: string | null;
  /** Override for tests; defaults to the public API base. */
  readonly baseUrl?: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_BASE = 'https://api.paystack.co';

function normaliseStatus(status: string | undefined): PaymentStatus {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'failed';
    case 'abandoned':
      return 'abandoned';
    default:
      return 'pending';
  }
}

export function createPaystackProvider(
  config: PaystackConfig,
  fetchImpl?: FetchLike,
): PaymentProvider {
  const base = (config.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
  const secret = config.secretKey ?? '';
  const doFetch: FetchLike = fetchImpl ?? ((input, init) => fetch(input, init));

  function requireConfigured(): void {
    if (!secret.startsWith('sk_test_')) {
      throw new PaymentProviderError(
        'unconfigured',
        'Paystack is not configured for test mode in this environment.',
      );
    }
  }

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    const response = await doFetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    const parsed: unknown = (() => {
      try {
        return text.length > 0 ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    })();

    if (!response.ok) {
      // Never surface the secret or the raw body; only a coarse reason.
      const paystackMessage =
        typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : undefined;
      throw new PaymentProviderError(
        'provider',
        paystackMessage ? 'Paystack rejected the request.' : 'Paystack request failed.',
      );
    }

    return parsed as T;
  }

  async function verifyRef(reference: string): Promise<PaymentVerification> {
    requireConfigured();
    const result = await call<{
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        paid_at?: string;
        channel?: string;
      };
    }>('/transaction/verify/' + encodeURIComponent(reference), { method: 'GET' });

    const data = result.data;
    if (!data || typeof data.amount !== 'number' || !data.currency) {
      throw new PaymentProviderError('not-found', 'Paystack returned no transaction.');
    }

    return {
      providerId: 'paystack',
      reference,
      status: normaliseStatus(data.status),
      amountMinor: Math.round(data.amount),
      currency: data.currency,
      ...(data.paid_at ? { paidAt: data.paid_at } : {}),
      ...(data.channel ? { channel: data.channel } : {}),
    };
  }

  return {
    id: 'paystack',
    label: 'Paystack (test mode)',

    isConfigured() {
      return secret.startsWith('sk_test_');
    },

    async initialise(request: CheckoutRequest): Promise<CheckoutSession> {
      requireConfigured();
      if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
        throw new PaymentProviderError('amount-mismatch', 'Amount must be a positive integer.');
      }

      const body = {
        email: request.email,
        amount: request.amountMinor, // minor units (kobo) — matches Paystack
        currency: request.currency,
        reference: request.reference,
        callback_url: request.callbackUrl,
        ...(request.metadata ? { metadata: request.metadata } : {}),
      };

      const result = await call<{
        data?: { authorization_url?: string; reference?: string; access_code?: string };
      }>('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const authorizationUrl = result.data?.authorization_url;
      if (!authorizationUrl) {
        throw new PaymentProviderError('provider', 'Paystack did not return a checkout URL.');
      }

      return {
        providerId: 'paystack',
        id: result.data?.reference ?? request.reference,
        reference: request.reference,
        amountMinor: request.amountMinor,
        currency: request.currency,
        authorizationUrl,
      };
    },

    async verify(reference: string): Promise<PaymentVerification> {
      return verifyRef(reference);
    },

    async verifyWebhook(input): Promise<WebhookEvent | null> {
      requireConfigured();

      const signatureResult = await verifySignature({
        secret,
        rawBody: input.rawBody,
        signature: input.signature,
      });
      if (!signatureResult.valid) {
        throw new PaymentProviderError('invalid-signature', 'The webhook signature is invalid.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(input.rawBody);
      } catch {
        return null;
      }

      const event = parsed as {
        event?: string;
        data?: { reference?: string; status?: string; amount?: number; currency?: string };
      };

      const reference = event.data?.reference;
      if (!event.event || !reference) return null;
      // Only payment events are ours.
      if (!/charge|payment/i.test(event.event)) return null;

      return {
        providerId: 'paystack',
        type: event.event,
        reference,
        status: normaliseStatus(event.data?.status),
        ...(typeof event.data?.amount === 'number'
          ? { amountMinor: Math.round(event.data.amount) }
          : {}),
        ...(event.data?.currency ? { currency: event.data.currency } : {}),
        payload: parsed,
      };
    },

    async refund(request: RefundRequest): Promise<RefundResult> {
      requireConfigured();
      if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
        throw new PaymentProviderError('amount-mismatch', 'Refund amount must be positive.');
      }

      // Verify the transaction is successful and get the captured amount/currency
      // from the provider — never trust a browser-supplied amount.
      const verification = await verifyRef(request.reference);
      if (verification.status !== 'success') {
        throw new PaymentProviderError(
          'provider',
          'Only a successful transaction can be refunded.',
        );
      }
      if (request.amountMinor > verification.amountMinor) {
        throw new PaymentProviderError('amount-mismatch', 'Refund exceeds the captured amount.');
      }

      const result = await call<{
        data?: { id?: number | string; status?: string };
      }>('/refund', {
        method: 'POST',
        body: JSON.stringify({
          transaction: request.reference,
          ...(request.reason ? { reason: request.reason } : {}),
        }),
      });

      const data = result.data;
      const refundReference = data?.id != null ? String(data.id) : undefined;
      const status: RefundResult['status'] =
        data?.status === 'success' ? 'success' : data?.status === 'failed' ? 'failed' : 'pending';

      return {
        providerId: 'paystack',
        reference: request.reference,
        amountMinor: request.amountMinor,
        ...(refundReference ? { refundReference } : {}),
        status,
      };
    },
  };
}

/**
 * Confirm a verification matches the original checkout (amount + currency).
 * Exposed for the route layer so it never trusts a browser-supplied amount.
 */
export function assertCheckoutMatches(
  expected: { amountMinor: number; currency: string },
  actual: { amountMinor: number; currency: string },
): void {
  assertAmountMatches(expected, actual);
}
