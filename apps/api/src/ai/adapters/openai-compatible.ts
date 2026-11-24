/**
 * OpenAI-compatible adapter.
 *
 * Many providers (OpenAI, Groq, Together, OpenRouter, Mistral, local Ollama and
 * any other Chat-Completions-compatible gateway) speak the same request/response
 * shape. This adapter targets that shape so a new provider is configuration, not
 * code — the application never depends on a single vendor.
 *
 * Safety posture mirrors the Gemini adapter:
 *   * `isConfigured()` requires a key **and** the explicit `AI_ENABLED` switch;
 *   * the key travels in the `Authorization` header, never the URL;
 *   * provider text is normalised and errors are mapped, never echoed.
 */

import type { AiFinishReason, AiUsage } from '@quickbiz/shared';
import {
  AiProviderError,
  type AiGenerateRequest,
  type AiGenerateResponse,
  type AiProvider,
} from '../provider';

export interface OpenAICompatibleOptions {
  /** Stable id, e.g. `openai`, `groq`, `openrouter`. */
  readonly id: string;
  readonly label: string;
  readonly apiKey: string | null;
  readonly enabled: boolean;
  /** Full base URL, e.g. `https://api.openai.com/v1`. */
  readonly baseUrl: string;
  readonly defaultModel: string;
  /** Override for tests. */
  readonly fetchImpl?: typeof fetch;
}

interface ChatResponse {
  readonly choices?: readonly {
    readonly message?: { readonly content?: string };
    readonly finish_reason?: string;
  }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
  readonly error?: { readonly message?: string };
}

function mapFinishReason(reason: string | null | undefined): AiFinishReason {
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content-filter';
    default:
      return 'stop';
  }
}

export function createOpenAICompatibleAdapter(
  options: OpenAICompatibleOptions,
): AiProvider {
  const base = options.baseUrl.replace(/\/$/, '');
  const doFetch = options.fetchImpl ?? fetch;

  return {
    id: options.id,
    label: options.label,
    defaultModel: options.defaultModel,

    isConfigured(): boolean {
      return options.enabled && typeof options.apiKey === 'string' && options.apiKey.length > 0;
    },

    async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
      if (!this.isConfigured()) {
        throw new AiProviderError('not-configured', `${options.label} is not configured.`);
      }

      const model = request.model ?? options.defaultModel;

      let response: Response;
      try {
        response = await doFetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${options.apiKey ?? ''}`,
          },
          body: JSON.stringify({
            model,
            temperature: request.temperature,
            max_tokens: request.maxOutputTokens,
            messages: [
              { role: 'system', content: request.system },
              ...request.messages.map((message) => ({
                role: message.role,
                content: message.content,
              })),
            ],
          }),
          signal: request.signal,
        });
      } catch (error) {
        if (request.signal?.aborted) {
          throw new AiProviderError('cancelled', 'The request was cancelled.', { cause: error });
        }
        throw new AiProviderError('upstream', 'The request could not be sent.', { cause: error });
      }

      const raw = await response.text();
      let parsed: ChatResponse;
      try {
        parsed = raw.length > 0 ? (JSON.parse(raw) as ChatResponse) : {};
      } catch {
        throw new AiProviderError('invalid-response', 'The provider returned a non-JSON body.');
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new AiProviderError('rate-limited', 'The provider rate limit was reached.', {
            retryAfterSeconds: 30,
          });
        }
        if (response.status === 401 || response.status === 403) {
          throw new AiProviderError('not-configured', 'The provider rejected the credential.');
        }
        if (response.status >= 500) {
          throw new AiProviderError('upstream', 'The provider reported a server error.');
        }
        throw new AiProviderError('upstream', 'The provider rejected the request.');
      }

      const choice = parsed.choices?.[0];
      const text = choice?.message?.content?.trim() ?? '';
      if (text.length === 0) {
        throw new AiProviderError('invalid-response', 'The provider returned no text.');
      }

      const usage: AiUsage | undefined = parsed.usage
        ? {
            ...(parsed.usage.prompt_tokens === undefined
              ? {}
              : { inputTokens: parsed.usage.prompt_tokens }),
            ...(parsed.usage.completion_tokens === undefined
              ? {}
              : { outputTokens: parsed.usage.completion_tokens }),
            ...(parsed.usage.total_tokens === undefined
              ? {}
              : { totalTokens: parsed.usage.total_tokens }),
          }
        : undefined;

      return {
        text,
        providerId: options.id,
        model,
        finishReason: mapFinishReason(choice?.finish_reason),
        ...(usage === undefined ? {} : { usage }),
      };
    },
  };
}