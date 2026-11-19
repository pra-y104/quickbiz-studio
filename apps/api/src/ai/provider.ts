/**
 * Provider-independent AI contract.
 *
 * Adapters (M1B and later) implement `AiProvider`. Everything here is about the
 * boundary, not about a vendor: no SDK, no URL, no key and no network call.
 *
 * Rules an adapter must honour:
 *
 * 1. `generate` must reject with `AiProviderError`. The message is for server
 *    logs only: the pipeline discards it and returns a fixed message chosen by
 *    `code`, so provider text can never reach a caller.
 * 2. `generate` must abort promptly when `request.signal` fires. The pipeline
 *    also enforces its own timeout, so a slow adapter cannot hang a request.
 * 3. `isConfigured()` is capability, not intent: true only when the adapter can
 *    actually reach its provider with a usable credential.
 * 4. Reported `usage` and `finishReason` must come from the provider. Never
 *    estimate a token count to fill a field.
 */

import type { AiFinishReason, AiProviderErrorCode, AiToolSlug, AiUsage } from '@quickbiz/shared';

export interface AiMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface AiGenerateRequest {
  /** Which tool is running. Adapters never branch on this beyond logging. */
  readonly tool: AiToolSlug;
  /** Immutable template instruction, already composed with its output contract. */
  readonly system: string;
  readonly messages: readonly AiMessage[];
  /** Adapter default when omitted. */
  readonly model?: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  /** Cancellation from the caller and from the pipeline's timeout. */
  readonly signal?: AbortSignal;
}

/** Normalised response. Extra provider fields are dropped at the adapter edge. */
export interface AiGenerateResponse {
  readonly text: string;
  readonly providerId: string;
  readonly model: string;
  readonly finishReason: AiFinishReason;
  readonly usage?: AiUsage;
}

export interface AiProvider {
  /** Stable lowercase identifier, e.g. `fake` in tests. */
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  isConfigured(): boolean;
  generate(request: AiGenerateRequest): Promise<AiGenerateResponse>;
}

/**
 * The only error an adapter may throw across the boundary.
 *
 * `code` is a member of the shared `AI_PROVIDER_ERROR_CODES` list so the
 * interface can switch on it without knowing the provider. `retryAfterSeconds`
 * is advisory and set only when the provider actually supplied one.
 */
export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(
    code: AiProviderErrorCode,
    message: string,
    options: { readonly cause?: unknown; readonly retryAfterSeconds?: number } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AiProviderError';
    this.code = code;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export function isAiProviderError(error: unknown): error is AiProviderError {
  return error instanceof AiProviderError;
}

/**
 * Compose the system instruction with the tool's JSON contract.
 *
 * The templates stay untouched; the contract is appended here so a preview tool
 * and the pipeline cannot disagree about the required shape.
 */
export function composeSystemPrompt(template: {
  readonly system: string;
  readonly outputContract: string;
}): string {
  return `${template.system}\n\nReturn JSON matching this contract:\n${template.outputContract}`;
}
