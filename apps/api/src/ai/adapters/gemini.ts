/**
 * Google Gemini adapter.
 *
 * Responsibilities kept deliberately narrow:
 *
 * - build one `generateContent` request from the provider-neutral `AiGenerateRequest`;
 * - normalise the answer into `AiGenerateResponse` (text, model, finish reason, usage);
 * - map every failure to an `AiProviderErrorCode` with a **fixed** message.
 *
 * What it must never do:
 *
 * - log or return the API key, the prompt or a raw provider body;
 * - invent usage numbers or a model name;
 * - perform a network call itself — that belongs to the injected transport.
 *
 * The adapter is inert until a key is configured. Nothing in this build registers it
 * in `PRODUCTION_ADAPTERS`, so no production path can reach it.
 */

import type { AiFinishReason } from '@quickbiz/shared';
import type { AiGenerateRequest, AiGenerateResponse, AiProvider } from '../provider';
import { AiProviderError } from '../provider';
import type { AiJsonTransport, JsonRequest } from '../transport/http-transport';
import { AiTransportError } from '../transport/http-transport';

export const GEMINI_PROVIDER_ID = 'gemini' as const;
export const GEMINI_LABEL = 'Google Gemini' as const;

/**
 * Provisional default model. Model identifiers change; the final id is confirmed
 * against Google's own documentation at approval time (decision D2) and can be
 * overridden with `AI_MODEL` without a code change.
 */
export const GEMINI_PROVISIONAL_MODEL = 'gemini-2.5-flash' as const;

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  readonly text?: unknown;
}

interface GeminiCandidate {
  readonly content?: { readonly parts?: readonly GeminiPart[] };
  readonly finishReason?: unknown;
}

interface GeminiResponse {
  readonly modelVersion?: unknown;
  readonly candidates?: readonly GeminiCandidate[];
  readonly usageMetadata?: {
    readonly promptTokenCount?: unknown;
    readonly candidatesTokenCount?: unknown;
    readonly totalTokenCount?: unknown;
  };
  readonly promptFeedback?: { readonly blockReason?: unknown };
}

const FINISH_REASONS: Readonly<Record<string, AiFinishReason>> = {
  STOP: 'stop',
  MAX_TOKENS: 'length',
  SAFETY: 'content-filter',
  RECITATION: 'content-filter',
  BLOCKLIST: 'content-filter',
  PROHIBITED_CONTENT: 'content-filter',
  SPII: 'content-filter',
  OTHER: 'error',
  MALFORMED_FUNCTION_CALL: 'error',
};

export interface GeminiAdapterOptions {
  readonly transport: AiJsonTransport;
  /** Server-side secret. Never logged, never returned. */
  readonly apiKey: string | undefined;
  readonly model?: string;
  readonly apiRoot?: string;
}

function countTokens(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

function statusToCode(status: number): 'rate-limited' | 'not-configured' | 'upstream' {
  if (status === 429) return 'rate-limited';
  if (status === 401 || status === 403) return 'not-configured';
  return 'upstream';
}

export function createGeminiAdapter(options: GeminiAdapterOptions): AiProvider {
  const { transport, apiKey } = options;
  const model = options.model ?? GEMINI_PROVISIONAL_MODEL;
  const apiRoot = options.apiRoot ?? API_ROOT;

  const configured = typeof apiKey === 'string' && apiKey.trim().length > 0;

  function buildRequest(request: AiGenerateRequest): JsonRequest {
    const parts = [
      { text: request.system },
      ...request.messages.map((message) => ({ text: message.content })),
    ];

    return {
      url: `${apiRoot}/${encodeURIComponent(request.model ?? model)}:generateContent`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // The key travels in a header, never in the URL or the body.
        'x-goog-api-key': apiKey ?? '',
      },
      body: {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType: 'application/json',
        },
      },
      signal: request.signal,
    };
  }

  function extractText(payload: GeminiResponse): string {
    const candidate = payload.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new AiProviderError('invalid-response', 'The provider returned no content.');
    }

    const text = parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (text.length === 0) {
      throw new AiProviderError('invalid-response', 'The provider returned no text.');
    }
    return text;
  }

  return {
    id: GEMINI_PROVIDER_ID,
    label: GEMINI_LABEL,
    defaultModel: model,

    isConfigured() {
      return configured;
    },

    async generate(request) {
      if (!configured) {
        throw new AiProviderError('not-configured', 'No AI provider is configured.');
      }

      let response;
      try {
        response = await transport.send(buildRequest(request));
      } catch (error) {
        if (error instanceof AiTransportError && error.kind === 'aborted') {
          throw new AiProviderError('cancelled', 'The AI request was cancelled.');
        }
        throw new AiProviderError('upstream', 'The AI provider failed.');
      }

      if (response.status < 200 || response.status >= 300) {
        const code = statusToCode(response.status);
        const retryAfterSeconds = code === 'rate-limited' ? response.retryAfterSeconds : undefined;

        throw new AiProviderError(
          code,
          code === 'rate-limited'
            ? 'The AI provider asked us to slow down. Try again shortly.'
            : 'The AI provider failed.',
          retryAfterSeconds === undefined ? {} : { retryAfterSeconds },
        );
      }

      const payload = (response.body ?? null) as GeminiResponse | null;
      if (!payload || typeof payload !== 'object') {
        throw new AiProviderError(
          'invalid-response',
          'The AI provider returned an unreadable body.',
        );
      }

      const blockReason = payload.promptFeedback?.blockReason;
      if (typeof blockReason === 'string') {
        throw new AiProviderError('blocked', 'The AI provider blocked this request.');
      }

      const candidate = payload.candidates?.[0];
      const finishReason = FINISH_REASONS[String(candidate?.finishReason ?? '')];

      if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'RECITATION') {
        throw new AiProviderError('blocked', 'The AI provider blocked this request.');
      }
      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new AiProviderError(
          'invalid-response',
          'The AI response was cut off before it finished.',
        );
      }
      if (finishReason === 'error') {
        throw new AiProviderError('upstream', 'The AI provider reported a failure.');
      }

      const text = extractText(payload);

      const usage = payload.usageMetadata;
      const inputTokens = countTokens(usage?.promptTokenCount);
      const outputTokens = countTokens(usage?.candidatesTokenCount);
      const totalTokens = countTokens(usage?.totalTokenCount);

      const response_out: AiGenerateResponse = {
        text,
        providerId: GEMINI_PROVIDER_ID,
        model:
          typeof payload.modelVersion === 'string' && payload.modelVersion.length > 0
            ? payload.modelVersion
            : (request.model ?? model),
        finishReason: finishReason ?? 'stop',
        ...(inputTokens === undefined && outputTokens === undefined && totalTokens === undefined
          ? {}
          : {
              usage: {
                ...(inputTokens === undefined ? {} : { inputTokens }),
                ...(outputTokens === undefined ? {} : { outputTokens }),
                ...(totalTokens === undefined ? {} : { totalTokens }),
              },
            }),
      };

      return response_out;
    },
  };
}
