/**
 * Resend email adapter.
 *
 * Maps the provider-neutral `EmailProvider` contract onto Resend's REST API so
 * the rest of the application never depends on Resend field names.
 *
 * Safety posture:
 *   * **Server-side only.** The API key is read from a Worker secret and is never
 *     logged or returned.
 *   * **No network in tests.** Every call takes an injectable `fetch`, so the
 *     adapter is fully tested against a fake without contacting Resend.
 *   * **Configured only with a key and a verified sender.** `isConfigured()` is
 *     true solely when both an API key and a `from` address are present.
 *   * **Idempotent retries.** The caller's idempotency key is forwarded so a
 *     retried request does not deliver the same message twice.
 */

import {
  EmailProviderError,
  isEmailAddress,
  type EmailMessage,
  type EmailProvider,
  type EmailResult,
} from './provider';

export interface ResendConfig {
  /** Resend API key (`re_...`). Server-side only. */
  readonly apiKey: string | null;
  /** Verified sender, e.g. `QuickBiz <noreply@quickbiz.example>`. */
  readonly from: string | null;
  /** Override for tests; defaults to the public API base. */
  readonly baseUrl?: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_BASE = 'https://api.resend.com';

export function createResendProvider(config: ResendConfig, fetchImpl?: FetchLike): EmailProvider {
  const base = (config.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
  const apiKey = config.apiKey ?? '';
  const from = config.from ?? '';
  const doFetch: FetchLike = fetchImpl ?? ((input, init) => fetch(input, init));

  function requireConfigured(): void {
    if (apiKey.length === 0 || from.length === 0) {
      throw new EmailProviderError('unconfigured', 'Resend is not configured in this environment.');
    }
  }

  return {
    id: 'resend',

    isConfigured() {
      return apiKey.length > 0 && from.length > 0;
    },

    async send(message: EmailMessage): Promise<EmailResult> {
      requireConfigured();
      if (!isEmailAddress(message.to)) {
        throw new EmailProviderError('invalid-recipient', 'Recipient address is not valid.');
      }

      const response = await doFetch(`${base}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
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
        // Never surface the key or the raw body; only a coarse reason.
        throw new EmailProviderError('provider', 'Resend rejected the message.');
      }

      const id =
        typeof parsed === 'object' && parsed !== null && 'id' in parsed
          ? String((parsed as { id: unknown }).id)
          : null;

      return { providerId: 'resend', id, status: 'sent' };
    },
  };
}
