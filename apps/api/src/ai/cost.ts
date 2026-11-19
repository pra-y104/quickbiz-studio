/**
 * Cost estimation interfaces.
 *
 * This module contains no prices. A price table is owner-supplied data for a
 * real deployment; importing a made-up rate here would silently misprice usage.
 *
 * Amounts are integer **micros of the provider's billing currency** (for
 * example 1_000_000 = 1.00 USD), not credits. Credits, wallets and billing are
 * Stage 7 concerns and are deliberately absent.
 */

import type { AiUsage } from '@quickbiz/shared';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

/** Owner-provided rates for one provider/model pair. */
export interface AiPriceTable {
  readonly providerId: string;
  readonly model: string;
  /** ISO 4217 code of the currency the provider bills in. */
  readonly currency: string;
  readonly inputMicrosPerToken: number;
  readonly outputMicrosPerToken: number;
}

export interface AiPriceKey {
  readonly providerId: string;
  readonly model: string;
}

export interface AiCostEstimate {
  /** Billing currency, or null when nothing can be priced. */
  readonly currency: string | null;
  /** Estimated cost in micros, or null when unknown. */
  readonly amountMicros: number | null;
  readonly basis: 'unpriced' | 'estimated';
}

/** Returned whenever a run cannot be priced. Never guessed. */
export const UNPRICED_ESTIMATE: AiCostEstimate = {
  currency: null,
  amountMicros: null,
  basis: 'unpriced',
};

export interface AiCostEstimator {
  estimate(usage: AiUsage | undefined, key: AiPriceKey): AiCostEstimate;
}

function assertPriceTable(table: AiPriceTable): void {
  if (!PROVIDER_ID_PATTERN.test(table.providerId)) {
    throw new Error(`Invalid AI price table provider id: ${table.providerId}`);
  }
  if (table.model.length === 0) {
    throw new Error('AI price table requires a model id.');
  }
  if (!CURRENCY_PATTERN.test(table.currency)) {
    throw new Error(`Invalid AI price table currency: ${table.currency}`);
  }
  for (const rate of [table.inputMicrosPerToken, table.outputMicrosPerToken]) {
    if (!Number.isFinite(rate) || !Number.isInteger(rate) || rate < 0) {
      throw new Error('AI price table rates must be non-negative integer micros.');
    }
  }
}

/**
 * Build an estimator from explicit tables.
 *
 * Provider and model must both match; a missing entry yields `unpriced` rather
 * than falling back to another model's rate. Usage must include both token
 * counts, otherwise the estimate cannot be complete and is left unpriced.
 */
export function createPriceTableEstimator(tables: readonly AiPriceTable[]): AiCostEstimator {
  const index = new Map<string, AiPriceTable>();
  for (const table of tables) {
    assertPriceTable(table);
    index.set(`${table.providerId}:${table.model}`, table);
  }

  return {
    estimate(usage, key) {
      const table = index.get(`${key.providerId}:${key.model}`);
      if (!table || !usage) return UNPRICED_ESTIMATE;

      const { inputTokens, outputTokens } = usage;
      if (inputTokens === undefined || outputTokens === undefined) return UNPRICED_ESTIMATE;

      const amountMicros =
        inputTokens * table.inputMicrosPerToken + outputTokens * table.outputMicrosPerToken;

      if (!Number.isSafeInteger(amountMicros) || amountMicros < 0) return UNPRICED_ESTIMATE;

      return { currency: table.currency, amountMicros, basis: 'estimated' };
    },
  };
}

/** The production default in M1A: no price tables, so every run is unpriced. */
export const unpricedCostEstimator: AiCostEstimator = {
  estimate: () => UNPRICED_ESTIMATE,
};
