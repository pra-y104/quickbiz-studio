import { describe, expect, it } from 'vitest';
import {
  addDateParts,
  addDays,
  calendarBreakdown,
  countWeekdays,
  dateDifference,
  daysBetween,
  describeDateParts,
  formatIsoDate,
  formatLongDate,
  parseIsoDate,
  subtractDateParts,
} from '../tools/dates';

function iso(value: string): Date {
  const date = parseIsoDate(value);
  if (!date) throw new Error(`Invalid fixture date ${value}`);
  return date;
}

describe('parseIsoDate', () => {
  it('accepts valid calendar dates', () => {
    expect(formatIsoDate(iso('2026-11-18'))).toBe('2026-11-18');
    expect(formatIsoDate(iso('2028-02-29'))).toBe('2028-02-29');
  });

  it('rejects impossible or loosely written dates', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('18/11/2026')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });
});

describe('day arithmetic', () => {
  it('counts days between dates without timezone drift', () => {
    expect(daysBetween(iso('2026-01-01'), iso('2026-03-01'))).toBe(59);
    expect(daysBetween(iso('2026-03-01'), iso('2026-01-01'))).toBe(-59);
  });

  it('adds and subtracts days', () => {
    expect(formatIsoDate(addDays(iso('2026-12-30'), 5))).toBe('2027-01-04');
    expect(formatIsoDate(addDays(iso('2026-03-01'), -1))).toBe('2026-02-28');
  });

  it('clamps month overflow to the end of the month', () => {
    expect(formatIsoDate(addDateParts(iso('2026-01-31'), { years: 0, months: 1, days: 0 }))).toBe(
      '2026-02-28',
    );
    expect(formatIsoDate(addDateParts(iso('2028-01-31'), { years: 0, months: 1, days: 0 }))).toBe(
      '2028-02-29',
    );
    expect(formatIsoDate(addDateParts(iso('2024-02-29'), { years: 1, months: 0, days: 0 }))).toBe(
      '2025-02-28',
    );
  });

  it('subtracts calendar parts', () => {
    expect(
      formatIsoDate(subtractDateParts(iso('2026-11-18'), { years: 1, months: 2, days: 3 })),
    ).toBe('2025-09-15');
  });

  it('combines months and days in one operation', () => {
    expect(formatIsoDate(addDateParts(iso('2026-01-15'), { years: 0, months: 2, days: 20 }))).toBe(
      '2026-04-04',
    );
  });

  it('formats a long readable date', () => {
    expect(formatLongDate(iso('2026-11-18'), 'en-GB')).toBe('Wednesday, 18 November 2026');
  });
});

describe('dateDifference', () => {
  it('orders the inputs and reports a calendar breakdown', () => {
    const difference = dateDifference(iso('2026-03-01'), iso('2026-01-01'));
    expect(difference.totalDays).toBe(59);
    expect(difference.earlier).toEqual(iso('2026-01-01'));
    expect(difference.later).toEqual(iso('2026-03-01'));
    expect(difference.calendar).toEqual({ years: 0, months: 2, days: 0 });
    expect(difference.weeks).toBe(8);
    expect(difference.remainderDays).toBe(3);
  });

  it('counts weekdays, counting the earlier date and excluding the later one', () => {
    // Monday to Friday is four working days.
    expect(countWeekdays(iso('2026-11-16'), iso('2026-11-20'))).toBe(4);
    expect(dateDifference(iso('2026-11-16'), iso('2026-11-20')).weekdays).toBe(4);
  });

  it('handles multi-year spans', () => {
    const difference = dateDifference(iso('2024-02-29'), iso('2026-03-01'));
    expect(difference.calendar).toEqual({ years: 2, months: 0, days: 1 });
  });

  it('reports the same day cleanly', () => {
    expect(dateDifference(iso('2026-05-05'), iso('2026-05-05')).totalDays).toBe(0);
    expect(describeDateParts(calendarBreakdown(iso('2026-05-05'), iso('2026-05-05')))).toBe(
      'Same day',
    );
  });

  it('describes parts in plain English', () => {
    expect(describeDateParts({ years: 1, months: 2, days: 3 })).toBe('1 year, 2 months, 3 days');
    expect(describeDateParts({ years: 0, months: 0, days: 1 })).toBe('1 day');
  });
});
