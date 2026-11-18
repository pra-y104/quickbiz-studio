import { CURRENCIES, type CurrencyCode } from '../types/currency';

export interface FormatMoneyOptions {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  /** BCP-47 locale, e.g. "en", "en-NG", "fr". Defaults to "en". */
  readonly locale?: string;
  /** Hide the currency symbol (useful in table columns). */
  readonly plain?: boolean;
}

/**
 * Format an integer minor-unit amount (kobo, cents) as localised currency text.
 * Throws on non-integer or non-finite input rather than displaying a wrong number.
 */
export function formatMoney({
  amountMinor,
  currency,
  locale = 'en',
  plain = false,
}: FormatMoneyOptions): string {
  if (!Number.isFinite(amountMinor) || !Number.isInteger(amountMinor)) {
    throw new TypeError('formatMoney requires an integer amountMinor value');
  }

  const definition = CURRENCIES[currency];
  if (!definition) {
    throw new TypeError(`Unsupported currency code: ${currency}`);
  }

  const major = amountMinor / 10 ** definition.digits;
  const formatter = new Intl.NumberFormat(locale, {
    style: plain ? 'decimal' : 'currency',
    currency,
    minimumFractionDigits: definition.digits,
    maximumFractionDigits: definition.digits,
  });

  return formatter.format(major);
}

/** Convert a major-unit number (naira, dollars) into integer minor units. */
export function toMinorUnits(amountMajor: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amountMajor)) {
    throw new TypeError('toMinorUnits requires a finite number');
  }
  const digits = CURRENCIES[currency].digits;
  return Math.round(amountMajor * 10 ** digits);
}

/** Convert integer minor units back to a major-unit number. */
export function toMajorUnits(amountMinor: number, currency: CurrencyCode): number {
  if (!Number.isInteger(amountMinor)) {
    throw new TypeError('toMajorUnits requires an integer amountMinor value');
  }
  return amountMinor / 10 ** CURRENCIES[currency].digits;
}
