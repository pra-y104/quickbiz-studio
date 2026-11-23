/**
 * Payment ledger port.
 *
 * The API never talks to Postgres directly. It writes payment attempts, stores
 * provider events and credits wallets through this interface, which is
 * implemented with service-role SQL functions (`supabase/migrations/0005_payments.sql`).
 *
 * No implementation ships in this build: the migration is prepared but not
 * applied, and the Worker has no database client. `UnconfiguredPaymentLedger`
 * therefore acknowledges webhooks without moving money, and reports
 * `isConfigured() === false` so the status endpoint cannot imply settlement works.
 */

export interface PaymentEventInput {
  readonly provider: string;
  readonly providerEventId: string;
  readonly type: string;
  readonly reference: string;
  readonly status: string;
  readonly payload: unknown;
}

export interface PaymentLedger {
  readonly id: string;
  isConfigured(): boolean;
  /** Store the event. Returns `duplicate: true` when it was already recorded. */
  recordEvent(event: PaymentEventInput): Promise<{ duplicate: boolean }>;
  /** Credit the wallet for a successful payment exactly once. */
  settle(reference: string): Promise<void>;
  /** Mark a payment failed without moving money. */
  fail(reference: string): Promise<void>;
}

export class UnconfiguredPaymentLedger implements PaymentLedger {
  readonly id = 'unconfigured';

  isConfigured(): boolean {
    return false;
  }

  async recordEvent(_event: PaymentEventInput): Promise<{ duplicate: boolean }> {
    return { duplicate: false };
  }

  async settle(_reference: string): Promise<void> {
    // No database is wired: acknowledge but never move money.
  }

  async fail(_reference: string): Promise<void> {
    // No database is wired.
  }
}

export const defaultPaymentLedger: PaymentLedger = new UnconfiguredPaymentLedger();
