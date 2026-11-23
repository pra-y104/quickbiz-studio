import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  enabledCurrencies,
  readStoredCurrency,
  readStoredLocale,
  storeCurrency,
  storeLocale,
} from './preferences';

describe('locale preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to English and USD', () => {
    expect(readStoredLocale()).toBe(DEFAULT_LOCALE);
    expect(readStoredCurrency()).toBe(DEFAULT_CURRENCY);
  });

  it('round-trips a stored selectable locale', () => {
    storeLocale('en');
    expect(readStoredLocale()).toBe('en');
  });

  it('falls back to English for an unknown locale', () => {
    storeLocale('zz');
    expect(readStoredLocale()).toBe(DEFAULT_LOCALE);
  });

  it('ignores a locale that is not selectable', () => {
    storeLocale('yo'); // planned, not yet selectable
    expect(readStoredLocale()).toBe(DEFAULT_LOCALE);
  });

  it('persists and reads an enabled currency', () => {
    storeCurrency('NGN');
    expect(readStoredCurrency()).toBe('NGN');
  });

  it('falls back for a disabled currency', () => {
    storeCurrency('JPY'); // present but not enabled
    expect(readStoredCurrency()).toBe(DEFAULT_CURRENCY);
  });

  it('lists only enabled currencies', () => {
    const currencies = enabledCurrencies();
    expect(currencies).toContain('USD');
    expect(currencies).toContain('NGN');
    expect(currencies).not.toContain('JPY');
  });
});
