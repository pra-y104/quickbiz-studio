/**
 * Gemini adapter.
 *
 * A real, provider-native adapter for Google's Generative Language REST API. It
 * uses `fetch` only — no vendor SDK, no dependency, no bundle impact — and every
 * network call is injectable so the adapter is fully testable offline.
 *
 * Safety posture:
 *   * **Capability, not intent.** `isConfigured()` is true only when a key is
 *     present *and* the deployment has explicitly set `AI_ENABLED=true`. A key
 *     alone never turns the platform on, so a stray secret cannot start billable
 *     traffic.
 *   * **No secret in the URL at rest.** The key is sent as the `x-goog-api-key`
 *     header rather than a query parameter, so it does not land in proxy logs.
 *   * **Normalised output.** Only the first candidate's text, the finish reason
 *     and provider usage counts cross the boundary; safety metadata is dropped.
 *   * **Errors are mapped, never echoed.** Provider messages stay server-side.
 */

import type { AiFinishReason, AiProviderErrorCode, AiUsage } from '@quickbiz/shared';
import {
  AiProviderError,
  type AiGenerateRequest,
  type AiGenerateResponse,
  type AiProvider,
} from '../provider';

export interface GeminiAdapterOptions {
  /** Google AI Studio key. Server-only. */
  readonly apiKey: string | null;
  /** Deployment switch. Both the key and this flag are required. */
  readonly enabled: boolean;
  readonly defaultModel?: string;
  /** Override for tests; defaults to the public endpoint. */
  readonly baseUrl?: string;
  /** Injectable transport. */
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.0-flash';

interface GeminiPart {
  readonly text?: string;
}

interface GeminiCandidate {
  readonly content?: { readonly parts?: readonly GeminiPart[] };
  readonly finishReason?: string;
}

interface GeminiResponse {
  readonly candidates?: readonly GeminiCandidate[];
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
    readonly totalTokenCount?: number;
  };
  readonly error?: { readonly message?: string };
}

function mapFinishReason(reason: string | undefined): AiFinishReason {
  switch (reason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
      return 'content-filter';
    case 'ERROR':
      return 'error';
    default:
      // A missing or unknown reason is treated as a normal stop; the text is
      // still validated against the tool contract downstream.
      return 'stop';
  }
}

function mapError(status: number, body: GeminiResponse): AiProviderError {
  if (status === 429) {
    return new AiProviderError('rate-limited', 'Gemini rate limit reached.', {
      retryAfterSeconds: 30,
    });
  }
  if (status === 401 || status === 403) {
    return new AiProviderError('not-configured', 'Gemini rejected the credential.');
  }
  if (status >= 500) {
    return new AiProviderError('upstream', 'Gemini reported a server error.');
  }
  void body;
  return new AiProviderError('upstream', 'Gemini rejected the request.');
}

function extractText(candidate: GeminiCandidate | undefined): string {
  const parts = candidate?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

export function createGeminiAdapter(options: GeminiAdapterOptions): AiProvider {
  const base = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
  const doFetch = options.fetchImpl ?? fetch;
  const defaultModel = options.defaultModel ?? DEFAULT_MODEL;

  return {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel,

    isConfigured(): boolean {
      return options.enabled && typeof options.apiKey === 'string' && options.apiKey.length > 0;
    },

    async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
      if (!this.isConfigured()) {
        throw new AiProviderError('not-configured', 'Gemini is not configured.');
      }

      const model = request.model ?? defaultModel;
      const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;

      let response: Response;
      try {
        response = await doFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': options.apiKey ?? '',
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system }] },
            contents: request.messages.map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
            generationConfig: {
              temperature: request.temperature,
              maxOutputTokens: request.maxOutputTokens,
            },
          }),
          signal: request.signal,
        });
      } catch (error) {
        if (request.signal?.aborted) {
          throw new AiProviderError('cancelled', 'The Gemini request was cancelled.', {
            cause: error,
          });
        }
        throw new AiProviderError('upstream', 'The Gemini request could not be sent.', {
          cause: error,
        });
      }

      const raw = await response.text();
      let parsed: GeminiResponse;
      try {
        parsed = raw.length > 0 ? (JSON.parse(raw) as GeminiResponse) : {};
      } catch {
        throw new AiProviderError('invalid-response', 'Gemini returned a non-JSON body.');
      }

      if (!response.ok) {
        throw mapError(response.status, parsed);
      }

      const candidate = parsed.candidates?.[0];
      const text = extractText(candidate);
      if (text.length === 0) {
        throw new AiProviderError('invalid-response', 'Gemini returned no text.');
      }

      const usage: AiUsage | undefined = parsed.usageMetadata
        ? {
            ...(parsed.usageMetadata.promptTokenCount === undefined
              ? {}
              : { inputTokens: parsed.usageMetadata.promptTokenCount }),
            ...(parsed.usageMetadata.candidatesTokenCount === undefined
              ? {}
              : { outputTokens: parsed.usageMetadata.candidatesTokenCount }),
            ...(parsed.usageMetadata.totalTokenCount === undefined
              ? {}
              : { totalTokens: parsed.usageMetadata.totalTokenCount }),
          }
        : undefined;

      return {
        text,
        providerId: 'gemini',
        model,
        finishReason: mapFinishReason(candidate?.finishReason),
        ...(usage === undefined ? {} : { usage }),
      };
    },
  };
}

/** Map an arbitrary provider error code for callers that only have a status. */
export function geminiErrorCodeForStatus(status: number): AiProviderErrorCode {
  if (status === 429) return 'rate-limited';
  if (status === 401 || status === 403) return 'not-configured';
  return 'upstream';
}
