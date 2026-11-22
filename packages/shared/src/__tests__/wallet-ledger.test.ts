import { describe, expect, it } from 'vitest';
import {
  applyEntry,
  availableBalance,
  isWalletEntry,
  releaseReservation,
  reserveFunds,
  settleReservation,
  walletBalance,
  WalletError,
  type WalletEntry,
} from '../index';

const NOW = new Date('2026-11-22T00:00:00.000Z');

function credit(id: string, amountMinor: number): WalletEntry {
  return {
    id,
    walletId: 'w1',
    kind: 'credit',
    amountMinor,
    currency: 'NGN',
    reference: `pay_${id}`,
    createdAt: NOW.toISOString(),
  };
}

describe('wallet ledger (Stage 7 domain)', () => {
  it('derives the balance from entries', () => {
    const entries = [credit('c1', 500_000), credit('c2', 250_000)];
    expect(walletBalance(entries)).toBe(750_000);
  });

  it('never goes negative', () => {
    const entries = [credit('c1', 10_000)];
    expect(() =>
      applyEntry(entries, {
        ...credit('d1', 20_000),
        id: 'd1',
        kind: 'debit',
        reference: 'run_1',
      }),
    ).toThrow(WalletError);
  });

  it('refuses duplicate entry ids (idempotency)', () => {
    const entries = [credit('c1', 10_000)];
    expect(() => applyEntry(entries, credit('c1', 5_000))).toThrow(/already been applied/);
  });

  it('refuses a currency mismatch', () => {
    const entries = [credit('c1', 10_000)];
    expect(() =>
      applyEntry(entries, {
        ...credit('c2', 1_000),
        id: 'c2',
        currency: 'USD',
      }),
    ).toThrow(/single currency/);
  });

  it('rejects malformed entries', () => {
    expect(isWalletEntry(null)).toBe(false);
    expect(isWalletEntry({ ...credit('c1', 100), amountMinor: -1 })).toBe(false);
    expect(isWalletEntry({ ...credit('c1', 100), amountMinor: 1.5 })).toBe(false);
    expect(isWalletEntry({ ...credit('c1', 100), kind: 'withdraw' })).toBe(false);
    expect(isWalletEntry(credit('c1', 100))).toBe(true);
  });

  it('reserves, settles and releases without overdrawing', () => {
    const start = [credit('c1', 100_000)];

    const reserved = reserveFunds(start, {
      id: 'r1',
      walletId: 'w1',
      amountMinor: 60_000,
      currency: 'NGN',
      reference: 'run_1',
      createdAt: NOW.toISOString(),
    });

    // A reservation holds funds: the balance is unchanged, availability drops.
    expect(reserved.balanceMinor).toBe(100_000);
    expect(availableBalance(reserved.entries)).toBe(40_000);

    const settled = settleReservation(
      reserved.entries,
      {
        ...(reserved.entries.find((entry) => entry.id === 'r1') as WalletEntry),
      },
      55_000,
    );

    // 100_000 - 55_000 debit + 60_000 release... the debit reduces the balance,
    // the release cancels the reservation.
    expect(walletBalance(settled.entries)).toBe(45_000);
    expect(availableBalance(settled.entries)).toBe(45_000);
  });

  it('refuses to reserve more than available', () => {
    const entries = [credit('c1', 10_000)];
    expect(() =>
      reserveFunds(entries, {
        id: 'r1',
        walletId: 'w1',
        amountMinor: 50_000,
        currency: 'NGN',
        reference: 'run_1',
        createdAt: NOW.toISOString(),
      }),
    ).toThrow(/not enough available balance/);
  });

  it('releases a reservation', () => {
    const entries = [credit('c1', 100_000)];
    const reserved = reserveFunds(entries, {
      id: 'r1',
      walletId: 'w1',
      amountMinor: 40_000,
      currency: 'NGN',
      reference: 'run_1',
      createdAt: NOW.toISOString(),
    });
    const reservation = reserved.entries.find((entry) => entry.id === 'r1');
    if (!reservation) throw new Error('missing reservation');

    const released = releaseReservation(reserved.entries, reservation);
    expect(availableBalance(released.entries)).toBe(100_000);
  });

  it('never applies a released entry twice', () => {
    const entries = [credit('c1', 100_000)];
    const reserved = reserveFunds(entries, {
      id: 'r1',
      walletId: 'w1',
      amountMinor: 40_000,
      currency: 'NGN',
      reference: 'run_1',
      createdAt: NOW.toISOString(),
    });
    const reservation = reserved.entries.find((entry) => entry.id === 'r1') as WalletEntry;
    const released = releaseReservation(reserved.entries, reservation);

    expect(() => releaseReservation(released.entries, reservation)).toThrow(/already been applied/);
  });
});
