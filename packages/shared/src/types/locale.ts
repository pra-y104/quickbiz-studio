/**
 * Locale support model.
 *
 * English ships complete. Additional locales are *prepared* infrastructure: they
 * are described here, can be selected in the interface, and fall back to English
 * for any key not yet translated. A locale is only marked `complete` when its
 * catalogue is finished — the UI never claims a language is ready before it is.
 */

export const SUPPORTED_LOCALES = ['en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleDefinition {
  readonly code: string;
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

/**
 * Languages the product is prepared to support.
 *
 * These are not yet translated: they appear in the interface as "coming soon"
 * and fall back to English. They exist so the language infrastructure (switcher,
 * persistence, Intl formatting, profile preference) is complete before any
 * catalogue is written, and so adding one is a data change, not a code change.
 */
export const PLANNED_LOCALES: readonly LocaleDefinition[] = [
  { code: 'yo', label: 'Yoruba', direction: 'ltr', intlLocale: 'yo', complete: false },
  { code: 'ha', label: 'Hausa', direction: 'ltr', intlLocale: 'ha', complete: false },
  { code: 'ig', label: 'Igbo', direction: 'ltr', intlLocale: 'ig', complete: false },
  { code: 'pcm', label: 'Nigerian Pidgin', direction: 'ltr', intlLocale: 'pcm', complete: false },
  { code: 'fr', label: 'French', direction: 'ltr', intlLocale: 'fr', complete: false },
  { code: 'es', label: 'Spanish', direction: 'ltr', intlLocale: 'es', complete: false },
  { code: 'pt', label: 'Portuguese', direction: 'ltr', intlLocale: 'pt', complete: false },
  { code: 'de', label: 'German', direction: 'ltr', intlLocale: 'de', complete: false },
  { code: 'ar', label: 'Arabic', direction: 'rtl', intlLocale: 'ar', complete: false },
  {
    code: 'zh',
    label: 'Chinese (Simplified)',
    direction: 'ltr',
    intlLocale: 'zh',
    complete: false,
  },
  { code: 'ja', label: 'Japanese', direction: 'ltr', intlLocale: 'ja', complete: false },
  { code: 'sw', label: 'Swahili', direction: 'ltr', intlLocale: 'sw', complete: false },
  { code: 'hi', label: 'Hindi', direction: 'ltr', intlLocale: 'hi', complete: false },
];

/** Every known locale, complete first, then planned. */
export function allLocales(): readonly LocaleDefinition[] {
  return [...Object.values(LOCALES), ...PLANNED_LOCALES];
}

/** A locale the interface can actually switch to right now. */
export function isSelectableLocale(code: string): boolean {
  return (Object.keys(LOCALES) as string[]).includes(code);
}

/** BCP-47 tag for Intl formatting, defaulting to English for unknown codes. */
export function intlLocaleFor(code: string): string {
  return allLocales().find((locale) => locale.code === code)?.intlLocale ?? 'en';
}

/** Text direction for layout, defaulting to left-to-right. */
export function directionFor(code: string): 'ltr' | 'rtl' {
  return allLocales().find((locale) => locale.code === code)?.direction ?? 'ltr';
}
