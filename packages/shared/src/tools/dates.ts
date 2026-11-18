/**
 * Calendar maths for the date calculator.
 *
 * Every date is handled as a UTC midnight so a user in Lagos and a user in
 * London get the same number of days for the same calendar dates. Only
 * `YYYY-MM-DD` input is accepted, which is what `<input type="date">` emits.
 */

const MS_PER_DAY = 86_400_000;

export interface DateParts {
  readonly years: number;
  readonly months: number;
  readonly days: number;
}

export interface DateDifference {
  /** Absolute number of days between the two dates. */
  readonly totalDays: number;
  readonly weeks: number;
  readonly remainderDays: number;
  /**
   * Monday-to-Friday days in the range. Counts the earlier date and excludes the
   * later one, so Monday to Friday is four weekdays, not five.
   */
  readonly weekdays: number;
  /** Human breakdown such as 1 year, 2 months, 3 days. */
  readonly calendar: DateParts;
  readonly earlier: Date;
  readonly later: Date;
}

/** Strict `YYYY-MM-DD` parsing; rejects impossible dates such as 2026-02-30. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLongDate(date: Date, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(date);
}

export function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + Math.round(days) * MS_PER_DAY);
}

/**
 * Add calendar years, months and days. Overflow is clamped to the end of the
 * target month, so 31 January plus one month is 28 (or 29) February.
 */
export function addDateParts(date: Date, parts: DateParts): Date {
  const targetYear = date.getUTCFullYear() + Math.trunc(parts.years);
  const targetMonthIndex = date.getUTCMonth() + Math.trunc(parts.months);
  const targetDay = date.getUTCDate();

  const startOfMonth = new Date(Date.UTC(targetYear, targetMonthIndex, 1));
  const daysInMonth = new Date(
    Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();

  startOfMonth.setUTCDate(Math.min(targetDay, daysInMonth));
  return addDays(startOfMonth, Math.trunc(parts.days));
}

export function subtractDateParts(date: Date, parts: DateParts): Date {
  return addDateParts(date, {
    years: -parts.years,
    months: -parts.months,
    days: -parts.days,
  });
}

function orderDates(a: Date, b: Date): { earlier: Date; later: Date } {
  return a.getTime() <= b.getTime() ? { earlier: a, later: b } : { earlier: b, later: a };
}

/** Calendar breakdown between two dates, largest unit first. */
export function calendarBreakdown(earlier: Date, later: Date): DateParts {
  let cursor = earlier;
  let years = 0;
  let months = 0;

  for (;;) {
    const next = addDateParts(cursor, { years: 1, months: 0, days: 0 });
    if (next.getTime() > later.getTime()) break;
    cursor = next;
    years += 1;
  }

  for (;;) {
    const next = addDateParts(cursor, { years: 0, months: 1, days: 0 });
    if (next.getTime() > later.getTime()) break;
    cursor = next;
    months += 1;
  }

  return { years, months, days: daysBetween(cursor, later) };
}

/** Monday-Friday count, counting `start` and excluding `end`. */
export function countWeekdays(start: Date, end: Date): number {
  const { earlier, later } = orderDates(start, end);
  const total = daysBetween(earlier, later);
  if (total === 0) return 0;

  let weekdays = 0;
  let cursor = earlier;
  for (let index = 0; index < total; index += 1) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) weekdays += 1;
    cursor = addDays(cursor, 1);
  }

  return weekdays;
}

export function dateDifference(start: Date, end: Date): DateDifference {
  const { earlier, later } = orderDates(start, end);
  const totalDays = daysBetween(earlier, later);

  return {
    totalDays,
    weeks: Math.floor(totalDays / 7),
    remainderDays: totalDays % 7,
    weekdays: countWeekdays(earlier, later),
    calendar: calendarBreakdown(earlier, later),
    earlier,
    later,
  };
}

/** Human sentence for a calendar breakdown, e.g. "1 year, 2 months, 3 days". */
export function describeDateParts(parts: DateParts): string {
  const segments: string[] = [];
  const units: ReadonlyArray<{ value: number; singular: string; plural: string }> = [
    { value: parts.years, singular: 'year', plural: 'years' },
    { value: parts.months, singular: 'month', plural: 'months' },
    { value: parts.days, singular: 'day', plural: 'days' },
  ];

  for (const unit of units) {
    if (unit.value > 0) {
      segments.push(`${unit.value} ${unit.value === 1 ? unit.singular : unit.plural}`);
    }
  }

  return segments.length === 0 ? 'Same day' : segments.join(', ');
}
