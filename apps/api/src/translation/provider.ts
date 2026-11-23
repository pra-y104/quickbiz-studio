/**
 * Translation provider contract.
 *
 * Provider-neutral: the translator UI and route depend only on this interface, so
 * a real provider (or none) can be chosen without touching call sites. No adapter
 * in this build performs a network request; until a provider is configured and
 * approved, `resolveTranslationProvider` returns `null` and the route fails closed.
 */

export interface TranslationRequest {
  readonly text: string;
  /** BCP-47 source code, or 'auto' to detect. */
  readonly source: string;
  /** BCP-47 target code. */
  readonly target: string;
}

export interface TranslationResult {
  readonly providerId: string;
  readonly translatedText: string;
  /** Present when the provider detected the source language. */
  readonly detectedSource?: string;
}

export type TranslationFailureCode = 'unconfigured' | 'invalid' | 'provider';

export class TranslationProviderError extends Error {
  readonly code: TranslationFailureCode;
  constructor(code: TranslationFailureCode, message: string) {
    super(message);
    this.name = 'TranslationProviderError';
    this.code = code;
  }
}

export interface TranslationProvider {
  readonly id: string;
  /** Capability, not intent: true only with usable credentials present. */
  isConfigured(): boolean;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export interface TranslationProviderFactory {
  (config: { readonly apiKey: string | null }): TranslationProvider | null;
}
