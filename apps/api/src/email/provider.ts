/**
 * Email provider contract.
 *
 * Provider-neutral, mirroring the payment and AI adapter patterns: the rest of
 * the application depends on this interface, never on Resend's field names.
 *
 * No adapter performs a network request unless a credential is present. When no
 * provider is configured the application keeps working and simply skips sending
 * (fail closed, never fabricating delivery).
 */

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /**
   * Optional idempotency key. The adapter forwards it so a retried send does not
   * deliver the same message twice.
   */
  readonly idempotencyKey?: string;
}

export interface EmailResult {
  readonly providerId: string;
  /** Provider message id, when one is returned. */
  readonly id: string | null;
  readonly status: 'sent' | 'failed';
}

export interface EmailProvider {
  readonly id: string;
  /** Capability, not intent: true only when a usable credential is present. */
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<EmailResult>;
}

export type EmailProviderErrorCode = 'unconfigured' | 'invalid-recipient' | 'provider';

export class EmailProviderError extends Error {
  readonly code: EmailProviderErrorCode;

  constructor(code: EmailProviderErrorCode, message: string) {
    super(message);
    this.name = 'EmailProviderError';
    this.code = code;
  }
}

/** A pragmatic single-recipient email shape check. Deliberately conservative. */
export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
