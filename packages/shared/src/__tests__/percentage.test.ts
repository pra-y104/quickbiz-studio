import { describe, expect, it } from 'vitest';
import {
  applyPercentChange,
  decreaseBy,
  increaseBy,
  originalBeforeIncrease,
  percentageChange,
  percentageDifference,
  percentagePointChange,
  percentOf,
  roundPercent,
  whatPercent,
} from '../tools/percentage';

describe('percentOf and whatPercent', () => {
  it('calculates a percentage of a value', () => {
    expect(percentOf(200, 15)).toBe(30);
    expect(percentOf(0, 15)).toBe(0);
    expect(percentOf(89.99, 7.5)).toBeCloseTo(6.74925, 6);
  });

  it('calculates what percent one value is of another', () => {
    expect(whatPercent(30, 200)).toBe(15);
    expect(whatPercent(200, 200)).toBe(100);
    expect(whatPercent(1, 0)).toBeNull();
  });
});

describe('percentageChange', () => {
  it('describes an increase', () => {
    expect(percentageChange(200, 250)).toEqual({
      difference: 50,
      percent: 25,
      direction: 'increase',
    });
  });

  it('describes a decrease', () => {
    expect(percentageChange(250, 200)).toEqual({
      difference: -50,
      percent: -20,
      direction: 'decrease',
    });
  });

  it('reports an unchanged value and a zero base as undefined', () => {
    expect(percentageChange(50, 50)?.direction).toBe('unchanged');
    expect(percentageChange(0, 10)).toBeNull();
  });

  it('uses the magnitude of a negative base', () => {
    expect(percentageChange(-100, -50)?.percent).toBe(50);
  });
});

describe('percentageDifference', () => {
  it('is symmetric around the average', () => {
    expect(percentageDifference(100, 120)).toBeCloseTo(18.181818, 5);
    expect(percentageDifference(120, 100)).toBeCloseTo(18.181818, 5);
  });

  it('is undefined when the average is zero', () => {
    expect(percentageDifference(0, 0)).toBeNull();
    expect(percentageDifference(-10, 10)).toBeNull();
  });
});

describe('applying changes', () => {
  it('applies signed changes and discount helpers', () => {
    expect(applyPercentChange(200, -12.5)).toBe(175);
    expect(increaseBy(200, 12.5)).toBe(225);
    expect(decreaseBy(200, -12.5)).toBe(175);
  });

  it('reverses an increase to recover the original value', () => {
    expect(originalBeforeIncrease(225, 12.5)).toBeCloseTo(200, 8);
    expect(originalBeforeIncrease(100, -100)).toBeNull();
  });

  it('describes percentage point change', () => {
    expect(percentagePointChange(40, 46)).toEqual({ points: 6, relative: 15 });
  });

  it('rounds for presentation only', () => {
    expect(roundPercent(18.181818)).toBe(18.18);
  });
});
