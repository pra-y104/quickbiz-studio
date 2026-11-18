/**
 * Currency model. Amounts are always stored as integer minor units (kobo, cents)
 * together with an ISO 4217 code. Never store money as a floating point number,
 * and never assume a currency from the user's country.
 */
export interface CurrencyDefinition {
  readonly name: string;
  readonly symbol: string;
  /** Number of decimal digits used by the currency (JPY 0, NGN 2, KWD 3). */
  readonly digits: number;
  /** Enabled for display or checkout in the current release. */
  readonly enabled: boolean;
}

export const CURRENCIES = {
  NGN: { name: 'Nigerian Naira', symbol: '\u20A6', digits: 2, enabled: true },
  USD: { name: 'US Dollar', symbol: '$', digits: 2, enabled: true },
  GBP: { name: 'Pound Sterling', symbol: '\u00A3', digits: 2, enabled: true },
  EUR: { name: 'Euro', symbol: '\u20AC', digits: 2, enabled: true },
  GHS: { name: 'Ghanaian Cedi', symbol: '\u20B5', digits: 2, enabled: true },
  KES: { name: 'Kenyan Shilling', symbol: 'KSh', digits: 2, enabled: true },
  ZAR: { name: 'South African Rand', symbol: 'R', digits: 2, enabled: true },
  INR: { name: 'Indian Rupee', symbol: '\u20B9', digits: 2, enabled: true },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$', digits: 2, enabled: true },
  AUD: { name: 'Australian Dollar', symbol: 'A$', digits: 2, enabled: true },
  AED: { name: 'UAE Dirham', symbol: 'AED', digits: 2, enabled: true },
  JPY: { name: 'Japanese Yen', symbol: '\u00A5', digits: 0, enabled: false },
} as const satisfies Record<string, CurrencyDefinition>;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Currencies currently enabled for pricing and display. */
export type EnabledCurrencyCode = {
  [K in CurrencyCode]: (typeof CURRENCIES)[K]['enabled'] extends true ? K : never;
}[CurrencyCode];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function getCurrency(code: CurrencyCode): CurrencyDefinition {
  return CURRENCIES[code];
}
