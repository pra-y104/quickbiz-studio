/**
 * AI text assistance — integration point only.
 *
 * This module exists so the editor has one place to call when AI writing is
 * approved. Today it cannot generate anything: the flag is `false`, no provider is
 * registered, no key is read and no request is made. The functions return a typed
 * "unavailable" result instead of throwing, so the interface can explain itself.
 *
 * When Stage 6 M1B is merged, reviewed and approved, the body of
 * `requestSuggestions` becomes a call to the API's `POST /api/v1/ai/run`, and this
 * file is the only editor-side change required.
 */

import { CREATIVE_STUDIO_FLAGS } from '../flags';

export type AiTextTask = 'headline' | 'caption' | 'description' | 'call-to-action';

export interface AiTextRequest {
  readonly task: AiTextTask;
  readonly brief: string;
  readonly tone?: 'neutral' | 'friendly' | 'confident' | 'playful';
  readonly language?: string;
  readonly maxLength?: number;
}

export interface AiTextSuggestion {
  readonly id: string;
  readonly text: string;
}

export type AiTextResult =
  | { readonly ok: true; readonly suggestions: readonly AiTextSuggestion[] }
  | {
      readonly ok: false;
      readonly reason: 'disabled' | 'unavailable' | 'refused';
      readonly message: string;
    };

/** True only when the approved provider work has landed and the flag is on. */
export function isAiTextAvailable(): boolean {
  return CREATIVE_STUDIO_FLAGS.aiText;
}

export function aiTextUnavailableMessage(): string {
  return 'AI writing assistance is not available in this build. Every element can still be written and edited by hand.';
}

/**
 * Ask for suggestions.
 *
 * Never contacts a network service in this build. When AI is enabled the
 * implementation must:
 *
 * - send only the brief the customer can see, never the whole document,
 * - enforce the shared input caps before the call,
 * - map failures with the API's `describeAiFailure` output,
 * - never surface provider text, keys or stack traces.
 */
export async function requestSuggestions(request: AiTextRequest): Promise<AiTextResult> {
  void request;

  if (!isAiTextAvailable()) {
    return { ok: false, reason: 'disabled', message: aiTextUnavailableMessage() };
  }

  // Not reachable while the flag is false. Kept as the documented seam for M1B.
  return {
    ok: false,
    reason: 'unavailable',
    message: 'AI writing is enabled but no approved provider is connected yet.',
  };
}

/**
 * Insert generated text as an ordinary editable text layer.
 *
 * The editor's `addText` is the only writer: generated content never replaces
 * existing content and is never inserted as HTML.
 */
export function insertSuggestionText(
  addText: (options: { text: string; fontSize?: number }) => void,
  suggestion: AiTextSuggestion,
): void {
  addText({ text: suggestion.text });
}
