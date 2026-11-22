/**
 * Wallet ledger primitives.
 *
 * Money is integer minor units of a single ISO currency. Balances are **derived**
 * from an append-only list of entries, never stored as a mutable number, so a
 * double submit or a retry cannot silently change what a customer owns.
 *
 * This module is pure and has no I/O: persistence, row-level security and the
 * database tables are separate, approval-dependent work. Everything here is
 * testable without a database and is the reference the database must implement.
 */

export const WALLET_ENTRY_KINDS = [
  /** Owner tops up: a payment succeeded. */
  'credit',
  /** Customer spends on an AI run. */
  'debit',
  /** Funds held before a paid call. */
  'reserve',
  /** A reservation was released without spending. */
  'release',
  /** A qualifying technical failure was refunded. */
  'refund',
] as const;

export type WalletEntryKind = (typeof WALLET_ENTRY_KINDS)[number];

export interface WalletEntry {
  /** Stable id, also the idempotency key for this entry. */
  readonly id: string;
  readonly walletId: string;
  readonly kind: WalletEntryKind;
  /** Positive integer minor units. */
  readonly amountMinor: number;
  /** ISO 4217 code of the currency the wallet holds. */
  readonly currency: string;
  /** Free-form reference: payment id, run id, receipt id. */
  readonly reference: string;
  readonly createdAt: string;
}

export class WalletError extends Error {
  readonly code: 'duplicate' | 'negative-balance' | 'currency-mismatch' | 'invalid-amount';

  constructor(code: WalletError['code'], message: string) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

/**
 * Signed sum of the entries, in minor units.
 *
 * A reservation does not change the balance: it *holds* funds, and
 * `availableBalance` reports what is left after holds. Treating a hold as a spend
 * would double-count it and make a released hold look like it never existed.
 */
export function walletBalance(entries: readonly WalletEntry[]): number {
  return entries.reduce((total, entry) => {
    if (entry.kind === 'debit') return total - entry.amountMinor;
    if (entry.kind === 'credit' || entry.kind === 'refund') return total + entry.amountMinor;
    // reserve and release move funds in and out of a hold; neither changes the balance.
    return total;
  }, 0);
}

export function isWalletEntry(value: unknown): value is WalletEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.walletId === 'string' &&
    typeof entry.kind === 'string' &&
    (WALLET_ENTRY_KINDS as readonly string[]).includes(entry.kind) &&
    typeof entry.amountMinor === 'number' &&
    Number.isSafeInteger(entry.amountMinor) &&
    entry.amountMinor > 0 &&
    typeof entry.currency === 'string' &&
    typeof entry.reference === 'string' &&
    typeof entry.createdAt === 'string'
  );
}

export interface ApplyEntryResult {
  readonly entries: readonly WalletEntry[];
  readonly balanceMinor: number;
}

/**
 * Append one entry.
 *
 * Invariants enforced here, so no caller can violate them by forgetting:
 *
 * - duplicate ids are refused (idempotency);
 * - a currency mismatch is refused (a wallet holds one currency);
 * - the resulting balance can never go negative (no overdraft);
 * - amounts must be positive integers in minor units.
 */
export function applyEntry(entries: readonly WalletEntry[], entry: WalletEntry): ApplyEntryResult {
  if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor <= 0) {
    throw new WalletError('invalid-amount', 'Amounts must be positive integers in minor units.');
  }

  if (entries.some((existing) => existing.id === entry.id)) {
    throw new WalletError('duplicate', 'That entry has already been applied.');
  }

  const currency = entries[0]?.currency ?? entry.currency;
  if (currency !== entry.currency) {
    throw new WalletError('currency-mismatch', 'A wallet holds a single currency.');
  }

  const next = [...entries, entry];
  const balanceMinor = walletBalance(next);

  if (balanceMinor < 0) {
    throw new WalletError('negative-balance', 'That would overdraw the wallet.');
  }

  return { entries: next, balanceMinor };
}

/**
 * Funds available to spend: balance minus **net** active reservations.
 *
 * A reservation is cancelled by a matching `release` entry, so releases must be
 * subtracted from the reserved total. Otherwise a released hold would keep reducing
 * the available balance forever.
 */
export function availableBalance(entries: readonly WalletEntry[]): number {
  const netReserved = entries.reduce((total, entry) => {
    if (entry.kind === 'reserve') return total + entry.amountMinor;
    if (entry.kind === 'release') return total - entry.amountMinor;
    return total;
  }, 0);

  return Math.max(0, walletBalance(entries) - Math.max(0, netReserved));
}

export interface ReserveOptions {
  readonly id: string;
  readonly amountMinor: number;
  readonly reference: string;
  readonly createdAt: string;
  readonly walletId: string;
  readonly currency: string;
}

/**
 * Reserve funds for a run.
 *
 * A reservation is an entry, not a mutation, so reversing it is another entry.
 * This is what stops a customer with one credit from firing ten parallel runs.
 */
export function reserveFunds(
  entries: readonly WalletEntry[],
  options: ReserveOptions,
): ApplyEntryResult {
  const balance = availableBalance(entries);
  if (options.amountMinor > balance) {
    throw new WalletError('negative-balance', 'There is not enough available balance.');
  }
  return applyEntry(entries, { ...options, kind: 'reserve' });
}

/** Release an unused reservation in full. */
export function releaseReservation(
  entries: readonly WalletEntry[],
  reservation: WalletEntry,
): ApplyEntryResult {
  if (reservation.kind !== 'reserve') {
    throw new WalletError('invalid-amount', 'Only a reservation can be released.');
  }
  return applyEntry(entries, {
    id: `${reservation.id}-release`,
    walletId: reservation.walletId,
    kind: 'release',
    amountMinor: reservation.amountMinor,
    currency: reservation.currency,
    reference: reservation.reference,
    createdAt: new Date().toISOString(),
  });
}

/** Settle a reservation: release it and debit the actual cost. */
export function settleReservation(
  entries: readonly WalletEntry[],
  reservation: WalletEntry,
  actualCostMinor: number,
  settledAt = new Date().toISOString(),
): ApplyEntryResult {
  let next = entries;

  if (actualCostMinor > 0) {
    const debited = applyEntry(next, {
      id: `${reservation.id}-settle`,
      walletId: reservation.walletId,
      kind: 'debit',
      amountMinor: actualCostMinor,
      currency: reservation.currency,
      reference: reservation.reference,
      createdAt: settledAt,
    });
    next = debited.entries;
  }

  const released = applyEntry(next, {
    id: `${reservation.id}-release`,
    walletId: reservation.walletId,
    kind: 'release',
    amountMinor: reservation.amountMinor,
    currency: reservation.currency,
    reference: reservation.reference,
    createdAt: settledAt,
  });

  return released;
}
