import { describe, expect, it } from 'vitest';
import {
  allLocales,
  directionFor,
  intlLocaleFor,
  isSelectableLocale,
  isSupportedLocale,
  LOCALES,
  PLANNED_LOCALES,
  SUPPORTED_LOCALES,
} from '../types/locale';

describe('locale model', () => {
  it('ships English as the only complete locale', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en']);
    expect(LOCALES.en.complete).toBe(true);
  });

  it('prepares the Nigerian and international languages as incomplete', () => {
    const codes = PLANNED_LOCALES.map((locale) => locale.code);
    expect(codes).toEqual(
      expect.arrayContaining(['yo', 'ha', 'ig', 'pcm', 'fr', 'es', 'ar', 'zh', 'sw', 'hi']),
    );
    expect(PLANNED_LOCALES.every((locale) => locale.complete === false)).toBe(true);
  });

  it('only lets the UI switch to a complete locale', () => {
    expect(isSelectableLocale('en')).toBe(true);
    expect(isSelectableLocale('yo')).toBe(false);
  });

  it('guards the supported-locale enum', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('yo')).toBe(false);
  });

  it('resolves Intl tags and direction with English defaults', () => {
    expect(intlLocaleFor('en')).toBe('en');
    expect(intlLocaleFor('ar')).toBe('ar');
    expect(intlLocaleFor('unknown')).toBe('en');
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
    expect(directionFor('unknown')).toBe('ltr');
  });

  it('lists complete locales before planned ones', () => {
    const locales = allLocales();
    expect(locales[0]?.code).toBe('en');
    expect(locales.some((locale) => locale.code === 'yo')).toBe(true);
  });
});
