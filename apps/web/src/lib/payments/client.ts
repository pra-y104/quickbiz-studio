/**
 * Payment API client.
 *
 * Every money-related call goes through the Worker, never directly to the
 * database. The browser supplies a session token; the Worker verifies it, then
 * talks to Paystack (test mode only unless explicitly approved) and the ledger.
 *
 * This module knows the routes and error shapes. It never invents prices,
 * never stores a secret, and never marks a payment successful on the client
 * alone: success is always confirmed by calling `/verify` server-side.
 */

import { createApiClient, type ApiClient } from '../api-client';
import { env } from '../env';

let api: ApiClient | null = null;

/** Lazily build the client so tests can inject their own. */
export function getPaymentsClient(): ApiClient {
  if (!api) {
    api = createApiClient({ baseUrl: env.apiBaseUrl });
  }
  return api;
}

/** Override for tests. */
export function setPaymentsClient(client: ApiClient): void {
  api = client;
}

export interface PaymentStatusResponse {
  readonly configured: boolean;
  readonly provider: string | null;
  readonly mode: string | null;
  readonly ledgerConfigured: boolean;
}

export interface CheckoutRequest {
  readonly amountMinor: number;
  readonly currency: string;
  readonly email: string;
  readonly reference?: string;
  readonly callbackUrl?: string;
}

export interface CheckoutSession {
  readonly reference: string;
  readonly authorizationUrl: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface PaymentVerification {
  readonly providerId: string;
  readonly reference: string;
  readonly status: 'pending' | 'success' | 'failed' | 'abandoned';
  readonly amountMinor: number;
  readonly currency: string;
  readonly paidAt?: string;
  readonly channel?: string;
}

export interface RefundRequest {
  readonly reference: string;
  readonly amountMinor: number;
  readonly reason?: string;
}

export interface RefundResult {
  readonly providerId: string;
  readonly reference: string;
  readonly amountMinor: number;
  readonly status: 'pending' | 'success' | 'failed';
}

/** Report whether a payment provider is configured (never exposes a key). */
export async function paymentStatus(): Promise<PaymentStatusResponse> {
  return getPaymentsClient().get<PaymentStatusResponse>('/api/v1/payments/status');
}

/** Start a checkout. Returns the provider's authorisation URL to send the customer to. */
export async function createCheckout(
  request: CheckoutRequest,
  token: string | null,
): Promise<CheckoutSession> {
  return getPaymentsClient().post<CheckoutSession>('/api/v1/payments/checkout', request, {
    token,
  });
}

/** Ask the provider for the truth about a reference. */
export async function verifyPayment(
  reference: string,
  token: string | null,
): Promise<PaymentVerification> {
  return getPaymentsClient().get<PaymentVerification>(
    `/api/v1/payments/verify/${encodeURIComponent(reference)}`,
    { token },
  );
}

/** Refund a paid transaction (provider-dependent; Paystack supports it). */
export async function refundPayment(
  request: RefundRequest,
  token: string | null,
): Promise<RefundResult> {
  return getPaymentsClient().post<RefundResult>('/api/v1/payments/refund', request, {
    token,
  });
}
