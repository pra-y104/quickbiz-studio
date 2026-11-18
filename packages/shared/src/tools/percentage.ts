/**
 * Percentage maths shared by the percentage calculator.
 *
 * Every function returns `null` when the result is mathematically undefined
 * (dividing by a zero base or a zero average) so the interface can explain the
 * case instead of printing "Infinity".
 */

import { roundTo } from './arithmetic';

export type ChangeDirection = 'increase' | 'decrease' | 'unchanged';

export interface PercentageChange {
  /** Signed difference between the two values. */
  readonly difference: number;
  /** Signed percentage change relative to the starting value. */
  readonly percent: number;
  readonly direction: ChangeDirection;
}

/** `percent` of `value`, e.g. 15% of 200 = 30. */
export function percentOf(value: number, percent: number): number {
  return (value * percent) / 100;
}

/** `part` as a percentage of `whole`, e.g. 30 of 200 = 15. */
export function whatPercent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return (part / whole) * 100;
}

/** Increase or decrease from `from` to `to`, relative to `from`. */
export function percentageChange(from: number, to: number): PercentageChange | null {
  if (from === 0) return null;

  const difference = to - from;
  const percent = (difference / Math.abs(from)) * 100;
  const direction: ChangeDirection =
    difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'unchanged';

  return { difference, percent, direction };
}

/**
 * Percentage difference between two values, relative to their average.
 * Symmetric: the order of the arguments does not matter.
 */
export function percentageDifference(a: number, b: number): number | null {
  const average = (a + b) / 2;
  if (average === 0) return null;
  return (Math.abs(a - b) / Math.abs(average)) * 100;
}

/** Apply a signed percentage change, e.g. 200 with -12.5% = 175. */
export function applyPercentChange(value: number, percent: number): number {
  return value * (1 + percent / 100);
}

/** Add `percent` to `value`. */
export function increaseBy(value: number, percent: number): number {
  return applyPercentChange(value, Math.abs(percent));
}

/** Subtract `percent` from `value`, never going below zero for a discount. */
export function decreaseBy(value: number, percent: number): number {
  return applyPercentChange(value, -Math.abs(percent));
}

/** Original value when `value` already includes `percent` (reverse percentage). */
export function originalBeforeIncrease(value: number, percent: number): number | null {
  const factor = 1 + percent / 100;
  if (factor === 0) return null;
  return value / factor;
}

export interface PercentageStep {
  /** Signed change in percentage points. */
  readonly points: number;
  /** Relative change of the two percentages. */
  readonly relative: number | null;
}

/** Change between two percentages, in points and relative terms. */
export function percentagePointChange(from: number, to: number): PercentageStep {
  const points = to - from;
  return { points, relative: percentageChange(from, to)?.percent ?? null };
}

/** Round for presentation only; calculations keep full precision. */
export function roundPercent(value: number, decimals = 2): number {
  return roundTo(value, decimals);
}
