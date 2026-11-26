/**
 * Payment provider contract.
 *
 * Deliberately provider-neutral: Paystack is the first candidate for Nigeria, but
 * nothing in the application should depend on its field names. Adapters normalise
 * their vendor payloads into these types, exactly as the AI adapters do.
 *
 * No adapter in this build performs a network request. The provider that ships today
 * is a simulation, used by tests and by local development until live credentials and
 * owner approval exist.
 */

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned';

export interface CheckoutRequest {
  /** Our own unique reference; the provider must echo it back. */
  readonly reference: string;
  /** Integer minor units of the checkout currency. */
  readonly amountMinor: number;
  /** ISO 4217 code. */
  readonly currency: string;
  readonly email: string;
  readonly callbackUrl: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface CheckoutSession {
  readonly providerId: string;
  readonly id: string;
  readonly reference: string;
  readonly amountMinor: number;
  readonly currency: string;
  /** Where the customer is sent to pay. Never opened by the server. */
  readonly authorizationUrl: string;
}

export interface PaymentVerification {
  readonly providerId: string;
  readonly reference: string;
  readonly status: PaymentStatus;
  readonly amountMinor: number;
  readonly currency: string;
  readonly paidAt?: string;
  readonly channel?: string;
}

export interface WebhookEvent {
  readonly providerId: string;
  readonly type: string;
  readonly reference: string;
  readonly status: PaymentStatus;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly payload: unknown;
}

export interface RefundRequest {
  readonly reference: string;
  readonly amountMinor: number;
  readonly reason?: string;
}

export interface RefundResult {
  readonly providerId: string;
  readonly reference: string;
  /** Provider-confirmed refunded amount (full amount only in this build). */
  readonly amountMinor: number;
  /** Provider's own refund id, stored for audit. Absent if the provider omits it. */
  readonly refundReference?: string;
  /** Only 'success' authorises recording the refund as completed. */
  readonly status: 'pending' | 'success' | 'failed';
}

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  /** Capability, not intent: true only with usable credentials present. */
  isConfigured(): boolean;
  initialise(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Server-side truth about a transaction. Never trusts the browser. */
  verify(reference: string): Promise<PaymentVerification>;
  /** Verify a signed webhook and normalise it. Returns null for unrelated events. */
  verifyWebhook(input: {
    readonly rawBody: string;
    readonly signature: string | null;
  }): Promise<WebhookEvent | null>;
  refund(request: RefundRequest): Promise<RefundResult>;
}

export class PaymentProviderError extends Error {
  readonly code:
    'unconfigured' | 'invalid-signature' | 'amount-mismatch' | 'not-found' | 'provider';

  constructor(code: PaymentProviderError['code'], message: string) {
    super(message);
    this.name = 'PaymentProviderError';
    this.code = code;
  }
}

/** Amount and currency must match the checkout request exactly. */
export function assertAmountMatches(
  expected: { amountMinor: number; currency: string },
  actual: { amountMinor: number; currency: string },
): void {
  if (actual.currency !== expected.currency || actual.amountMinor !== expected.amountMinor) {
    throw new PaymentProviderError(
      'amount-mismatch',
      'The provider reported a different amount or currency.',
    );
  }
}
