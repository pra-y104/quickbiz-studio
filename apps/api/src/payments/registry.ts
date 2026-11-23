/**
 * Payment provider registry.
 *
 * Resolves the active `PaymentProvider` from environment, or `null` when none is
 * configured so every payment route fails closed. Only a Paystack **test-mode**
 * key (`sk_test_`) is accepted here; a live key is ignored until the owner
 * explicitly approves live payments.
 */

import type { Bindings } from '../config/env';
import type { PaymentProvider } from './provider';
import { createPaystackProvider } from './paystack';

export function resolvePaymentProvider(bindings: Bindings): PaymentProvider | null {
  const key = bindings.PAYSTACK_SECRET_KEY?.trim();
  if (key && key.startsWith('sk_test_')) {
    return createPaystackProvider({
      secretKey: key,
      ...(bindings.PAYSTACK_BASE_URL ? { baseUrl: bindings.PAYSTACK_BASE_URL } : {}),
    });
  }
  return null;
}
