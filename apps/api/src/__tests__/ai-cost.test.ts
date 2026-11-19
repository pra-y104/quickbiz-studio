import { describe, expect, it } from 'vitest';
import {
  UNPRICED_ESTIMATE,
  createPriceTableEstimator,
  unpricedCostEstimator,
  type AiPriceTable,
} from '../ai/cost';

const table: AiPriceTable = {
  providerId: 'fake',
  model: 'fake-1',
  currency: 'USD',
  inputMicrosPerToken: 2,
  outputMicrosPerToken: 8,
};

const key = { providerId: 'fake', model: 'fake-1' };

const usage = { inputTokens: 1_000, outputTokens: 500 };

describe('cost estimation', () => {
  it('returns unpriced when no table is configured', () => {
    expect(unpricedCostEstimator.estimate(usage, key)).toEqual(UNPRICED_ESTIMATE);
  });

  it('returns unpriced when the provider or model has no table', () => {
    const estimator = createPriceTableEstimator([table]);
    expect(estimator.estimate(usage, { providerId: 'other', model: 'fake-1' })).toEqual(
      UNPRICED_ESTIMATE,
    );
    expect(estimator.estimate(usage, { providerId: 'fake', model: 'fake-2' })).toEqual(
      UNPRICED_ESTIMATE,
    );
  });

  it('estimates from an explicit table in integer micros', () => {
    const estimator = createPriceTableEstimator([table]);
    expect(estimator.estimate(usage, key)).toEqual({
      currency: 'USD',
      amountMicros: 1_000 * 2 + 500 * 8,
      basis: 'estimated',
    });
  });

  it('does not estimate when usage is missing or partial', () => {
    const estimator = createPriceTableEstimator([table]);
    expect(estimator.estimate(undefined, key)).toEqual(UNPRICED_ESTIMATE);
    expect(estimator.estimate({ inputTokens: 10 }, key)).toEqual(UNPRICED_ESTIMATE);
  });

  it('rejects malformed price tables', () => {
    expect(() => createPriceTableEstimator([{ ...table, currency: 'usd' }])).toThrow(/currency/);
    expect(() => createPriceTableEstimator([{ ...table, providerId: 'Not Valid' }])).toThrow(
      /provider id/,
    );
    expect(() => createPriceTableEstimator([{ ...table, inputMicrosPerToken: -1 }])).toThrow(
      /non-negative/,
    );
    expect(() => createPriceTableEstimator([{ ...table, outputMicrosPerToken: 1.5 }])).toThrow(
      /non-negative/,
    );
    expect(() => createPriceTableEstimator([{ ...table, model: '' }])).toThrow(/model/);
  });
});
