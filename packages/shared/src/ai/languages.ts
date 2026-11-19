/**
 * Language and tone vocabularies for the AI tools.
 *
 * The list is deliberately small and explicit: every value is a language the
 * product is prepared to display and support, not an open string that a provider
 * could interpret differently from run to run. Adding a language is a code change
 * with a test, not a free-text field.
 */

export interface AiLanguage {
  /** BCP-47 language subtag used in prompts and responses. */
  readonly code: string;
  /** English label shown in the interface. */
  readonly label: string;
  /** Right-to-left script, used for layout direction. */
  readonly rtl?: boolean;
}

export const AI_LANGUAGES: readonly AiLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic', rtl: true },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'sw', label: 'Swahili' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ha', label: 'Hausa' },
];

export const AI_LANGUAGE_CODES = [
  'en',
  'es',
  'fr',
  'pt',
  'de',
  'ar',
  'hi',
  'zh',
  'ja',
  'sw',
  'yo',
  'ha',
] as const;

export type AiLanguageCode = (typeof AI_LANGUAGE_CODES)[number];

/** Translator only: ask the provider to detect the source language. */
export const AI_SOURCE_LANGUAGE_CODES = ['auto', ...AI_LANGUAGE_CODES] as const;

export type AiSourceLanguageCode = (typeof AI_SOURCE_LANGUAGE_CODES)[number];

export function getAiLanguage(code: string): AiLanguage | undefined {
  return AI_LANGUAGES.find((language) => language.code === code);
}

export function isRtlLanguage(code: string): boolean {
  return getAiLanguage(code)?.rtl === true;
}
