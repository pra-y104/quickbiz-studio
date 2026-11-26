import { describe, expect, it } from 'vitest';
import {
  UnconfiguredPaymentLedger,
  type PaymentEventInput,
  type PaymentLedger,
  type PaymentRecord,
  type RefundRecordInput,
} from '../payments/ledger';

class FakeLedger implements PaymentLedger {
  readonly id = 'fake';
  readonly events: PaymentEventInput[] = [];
  readonly settled: string[] = [];
  readonly failed: string[] = [];
  readonly refunds: RefundRecordInput[] = [];
  #configured: boolean;
  #seen = new Set<string>();

  constructor(configured = true) {
    this.#configured = configured;
  }

  isConfigured(): boolean {
    return this.#configured;
  }

  async recordEvent(event: PaymentEventInput): Promise<{ duplicate: boolean }> {
    const key = `${event.provider}:${event.providerEventId}`;
    if (this.#seen.has(key)) return { duplicate: true };
    this.#seen.add(key);
    this.events.push(event);
    return { duplicate: false };
  }

  async settle(reference: string): Promise<void> {
    this.settled.push(reference);
  }

  async fail(reference: string): Promise<void> {
    this.failed.push(reference);
  }

  async getPayment(_reference: string): Promise<PaymentRecord | null> {
    return null;
  }

  async recordRefund(input: RefundRecordInput): Promise<void> {
    this.refunds.push(input);
  }
}

const event = (overrides: Partial<PaymentEventInput> = {}): PaymentEventInput => ({
  provider: 'paystack',
  providerEventId: 'evt_1',
  type: 'charge.success',
  reference: 'qb_1',
  status: 'success',
  payload: { event: 'charge.success' },
  ...overrides,
});

describe('payment ledger port', () => {
  it('reports unconfigured and never moves money by default', async () => {
    const ledger = new UnconfiguredPaymentLedger();
    expect(ledger.isConfigured()).toBe(false);
    expect((await ledger.recordEvent(event())).duplicate).toBe(false);
    // settle/fail resolve without error and without any side effect to observe.
    await expect(ledger.settle('qb_1')).resolves.toBeUndefined();
    await expect(ledger.fail('qb_1')).resolves.toBeUndefined();
    // No database is wired: getPayment returns null so callers fail closed, and
    // recordRefund is a no-op (it must never be reached because refunds fail closed).
    await expect(ledger.getPayment('qb_1')).resolves.toBeNull();
    await expect(
      ledger.recordRefund({ reference: 'qb_1', refundReference: 'r1', amountMinor: 100 }),
    ).resolves.toBeUndefined();
  });

  it('rejects a redelivered event as a duplicate', async () => {
    const ledger = new FakeLedger();
    expect((await ledger.recordEvent(event())).duplicate).toBe(false);
    expect((await ledger.recordEvent(event())).duplicate).toBe(true);
    expect(ledger.events).toHaveLength(1);
  });

  it('keeps events from different providers with the same id separate', async () => {
    const ledger = new FakeLedger();
    await ledger.recordEvent(event({ provider: 'paystack' }));
    await ledger.recordEvent(event({ provider: 'flutterwave' }));
    expect(ledger.events).toHaveLength(2);
  });

  it('settles only the reference it is given', async () => {
    const ledger = new FakeLedger();
    await ledger.settle('qb_1');
    expect(ledger.settled).toEqual(['qb_1']);
  });
});
