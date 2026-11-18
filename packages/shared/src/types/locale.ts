/**
 * Locale support model. English ships first; additional locales are additive and
 * must not require code changes outside the translation catalogue.
 */
export const SUPPORTED_LOCALES = ['en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleDefinition {
  readonly code: SupportedLocale;
  readonly label: string;
  readonly direction: 'ltr' | 'rtl';
  /** BCP-47 tag used for Intl number/date formatting. */
  readonly intlLocale: string;
  /** Whether the translation catalogue is complete enough for public use. */
  readonly complete: boolean;
}

export const LOCALES: Readonly<Record<SupportedLocale, LocaleDefinition>> = {
  en: {
    code: 'en',
    label: 'English',
    direction: 'ltr',
    intlLocale: 'en',
    complete: true,
  },
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
