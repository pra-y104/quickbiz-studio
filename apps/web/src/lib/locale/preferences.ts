/**
 * Locale and currency preferences.
 *
 * A display preference only. It never changes prices (there is no live exchange
 * rate) and never changes what a wallet holds; it controls how numbers and dates
 * are shown and which language catalogue is used. Persisted to localStorage so a
 * phone remembers the choice between visits.
 */

import { CURRENCIES, isCurrencyCode, type CurrencyCode } from '@quickbiz/shared';
import { isSelectableLocale } from '@quickbiz/shared';

const LOCALE_KEY = 'quickbiz.locale';
const CURRENCY_KEY = 'quickbiz.currency';

export const DEFAULT_LOCALE = 'en';
export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage disabled: the preference lasts for this tab only.
  }
}

/** Stored display locale, or the default when unset or no longer selectable. */
export function readStoredLocale(): string {
  const stored = read(LOCALE_KEY);
  return stored && isSelectableLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function storeLocale(locale: string): void {
  write(LOCALE_KEY, locale);
}

/** Stored display currency, or the default when unset or not enabled. */
export function readStoredCurrency(): CurrencyCode {
  const stored = read(CURRENCY_KEY);
  if (stored && isCurrencyCode(stored) && CURRENCIES[stored].enabled) return stored;
  return DEFAULT_CURRENCY;
}

export function storeCurrency(currency: CurrencyCode): void {
  write(CURRENCY_KEY, currency);
}

/** Enabled currencies in a stable display order. */
export function enabledCurrencies(): CurrencyCode[] {
  return (Object.keys(CURRENCIES) as CurrencyCode[]).filter((code) => CURRENCIES[code].enabled);
}
