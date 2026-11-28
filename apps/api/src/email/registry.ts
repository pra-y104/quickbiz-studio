/**
 * Email provider registry.
 *
 * Resolves the active `EmailProvider` from environment, or `null` when none is
 * configured so callers skip sending rather than fail. The key is server-side
 * only and never leaves the Worker.
 */

import type { Bindings } from '../config/env';
import type { EmailProvider } from './provider';
import { createResendProvider } from './resend';

export function resolveEmailProvider(bindings: Bindings): EmailProvider | null {
  const apiKey = bindings.RESEND_API_KEY?.trim();
  const from = bindings.RESEND_FROM_EMAIL?.trim();
  if (apiKey && from) {
    return createResendProvider({
      apiKey,
      from,
      ...(bindings.RESEND_BASE_URL ? { baseUrl: bindings.RESEND_BASE_URL } : {}),
    });
  }
  return null;
}
