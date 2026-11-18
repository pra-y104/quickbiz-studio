/** Timestamps are stored and transported in UTC; formatting is always explicit. */
export interface FormatDateTimeOptions {
  readonly locale?: string;
  /** IANA time zone, e.g. "Africa/Lagos". Defaults to UTC. */
  readonly timeZone?: string;
  readonly dateStyle?: 'full' | 'long' | 'medium' | 'short';
  readonly timeStyle?: 'full' | 'long' | 'medium' | 'short';
}

function parse(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid ISO date-time: ${iso}`);
  }
  return date;
}

export function formatDateTime(iso: string, options: FormatDateTimeOptions = {}): string {
  const { locale = 'en', timeZone = 'UTC', dateStyle = 'medium', timeStyle = 'short' } = options;
  return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone }).format(parse(iso));
}

export function formatDate(
  iso: string,
  options: Omit<FormatDateTimeOptions, 'timeStyle'> = {},
): string {
  const { locale = 'en', timeZone = 'UTC', dateStyle = 'medium' } = options;
  return new Intl.DateTimeFormat(locale, { dateStyle, timeZone }).format(parse(iso));
}

/** Human relative time such as "3 hours ago". */
export function formatRelativeTime(
  iso: string,
  reference: Date = new Date(),
  locale = 'en',
): string {
  const diffSeconds = Math.round((parse(iso).getTime() - reference.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const divisions: ReadonlyArray<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];

  let value = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(value) < division.amount) {
      return formatter.format(Math.round(value), division.unit);
    }
    value /= division.amount;
  }
  return formatter.format(Math.round(value), 'year');
}
