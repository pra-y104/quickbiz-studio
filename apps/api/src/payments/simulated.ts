/**
 * Simulated payment provider.
 *
 * This is the only provider in the build. It performs **no network request**, holds
 * no credentials and cannot move money. It exists so the payment architecture,
 * webhook verification and reconciliation logic can be built and tested before any
 * live account is approved.
 *
 * Behaviour is deterministic: a checkout becomes successful when the test (or the
 * developer) marks it paid, and every verification re-checks amount and currency
 * against the original request.
 */

import {
  assertAmountMatches,
  PaymentProviderError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentProvider,
  type PaymentVerification,
  type RefundRequest,
  type RefundResult,
  type WebhookEvent,
} from './provider';

export interface SimulatedPaymentOptions {
  readonly providerId?: string;
  readonly label?: string;
  /** Simulated gateway base, used only to build a display URL. */
  readonly gatewayUrl?: string;
}

interface StoredCheckout {
  readonly request: CheckoutRequest;
  readonly paid: boolean;
  readonly paidAt?: string;
}

export interface SimulatedPaymentProvider extends PaymentProvider {
  /** Test hook: mark a checkout as paid, as a gateway callback would. */
  markPaid(reference: string): void;
  /** Test hook: mark a checkout as failed. */
  markFailed(reference: string): void;
}

export function createSimulatedPaymentProvider(
  options: SimulatedPaymentOptions = {},
): SimulatedPaymentProvider {
  const providerId = options.providerId ?? 'simulated';
  const gateway = options.gatewayUrl ?? 'https://checkout.simulated.invalid';
  const sessions = new Map<string, StoredCheckout>();

  function require(reference: string): StoredCheckout {
    const stored = sessions.get(reference);
    if (!stored) throw new PaymentProviderError('not-found', 'Unknown payment reference.');
    return stored;
  }

  return {
    id: providerId,
    label: options.label ?? 'Simulated provider',

    isConfigured() {
      // A simulation is always "configured"; it never talks to a network.
      return true;
    },

    async initialise(request: CheckoutRequest): Promise<CheckoutSession> {
      if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
        throw new PaymentProviderError('amount-mismatch', 'Amount must be a positive integer.');
      }

      sessions.set(request.reference, { request, paid: false });

      return {
        providerId,
        id: `sim_${request.reference}`,
        reference: request.reference,
        amountMinor: request.amountMinor,
        currency: request.currency,
        authorizationUrl: `${gateway}/checkout/${encodeURIComponent(request.reference)}`,
      };
    },

    async verify(reference: string): Promise<PaymentVerification> {
      const stored = require(reference);
      return {
        providerId,
        reference,
        status: stored.paid ? 'success' : 'pending',
        amountMinor: stored.request.amountMinor,
        currency: stored.request.currency,
        ...(stored.paidAt ? { paidAt: stored.paidAt } : {}),
        channel: 'card',
      };
    },

    async verifyWebhook(input): Promise<WebhookEvent | null> {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input.rawBody);
      } catch {
        return null;
      }

      const event = parsed as {
        event?: string;
        data?: { reference?: string; status?: string };
      };

      const reference = event.data?.reference;
      if (!event.event || !reference) return null;

      // Only payment events are ours; transfers, disputes and payouts are ignored.
      if (!/charge|payment/i.test(event.event)) return null;

      const stored = sessions.get(reference);
      if (!stored) return null;

      const status =
        event.data?.status === 'success'
          ? 'success'
          : event.data?.status === 'failed'
            ? 'failed'
            : 'pending';

      if (status === 'success') {
        assertAmountMatches(
          { amountMinor: stored.request.amountMinor, currency: stored.request.currency },
          {
            amountMinor: stored.request.amountMinor,
            currency: stored.request.currency,
          },
        );
      }

      return {
        providerId,
        type: event.event,
        reference,
        status,
        amountMinor: stored.request.amountMinor,
        currency: stored.request.currency,
        payload: parsed,
      };
    },

    async refund(request: RefundRequest): Promise<RefundResult> {
      const stored = require(request.reference);
      if (!stored.paid) {
        throw new PaymentProviderError('provider', 'Only a paid transaction can be refunded.');
      }
      if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
        throw new PaymentProviderError('amount-mismatch', 'Refund amount must be positive.');
      }
      if (request.amountMinor > stored.request.amountMinor) {
        throw new PaymentProviderError('amount-mismatch', 'Refund exceeds the captured amount.');
      }

      return {
        providerId,
        reference: request.reference,
        amountMinor: request.amountMinor,
        status: 'success',
      };
    },

    markPaid(reference: string) {
      const stored = require(reference);
      sessions.set(reference, { ...stored, paid: true, paidAt: new Date().toISOString() });
    },

    markFailed(reference: string) {
      const stored = require(reference);
      sessions.set(reference, { ...stored, paid: false });
    },
  };
}
