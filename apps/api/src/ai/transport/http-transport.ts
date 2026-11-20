/**
 * The one place in `apps/api/src/ai` allowed to perform a network request.
 *
 * Stage 6 M1A banned networking inside `ai/**` outright. M1B opens exactly one
 * narrow, reviewed door: this module owns the HTTP call, and the ESLint boundary
 * was updated to permit `fetch` **only** in this file. Every other AI module stays
 * network-free and therefore testable offline.
 *
 * The transport knows nothing about Gemini: it sends JSON and returns a status and
 * a parsed body. Adapters own URLs, headers and payloads.
 *
 * Credentials are passed in by the caller per request and are never logged here.
 */

export interface JsonRequest {
  readonly url: string;
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly signal?: AbortSignal;
}

export interface JsonResponse {
  readonly status: number;
  readonly body: unknown;
  /** Value of `Retry-After` when the provider sent one, in seconds. */
  readonly retryAfterSeconds?: number;
}

export interface AiJsonTransport {
  send(request: JsonRequest): Promise<JsonResponse>;
}

/** Distinguishes a transport failure from a provider answer, without leaking text. */
export class AiTransportError extends Error {
  readonly kind: 'network' | 'aborted';

  constructor(kind: 'network' | 'aborted') {
    super(kind === 'aborted' ? 'The request was aborted.' : 'The request could not be delivered.');
    this.name = 'AiTransportError';
    this.kind = kind;
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.round(seconds);
}

/** `fetch`-backed JSON transport. The only network call in the AI module tree. */
export function createFetchTransport(): AiJsonTransport {
  return {
    async send(request) {
      let response: Response;
      try {
        response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: request.signal,
        });
      } catch (error) {
        if (request.signal?.aborted) throw new AiTransportError('aborted');
        // The provider's message may contain a URL or key material; it is discarded.
        void error;
        throw new AiTransportError('network');
      }

      // A non-JSON body is still a provider answer; adapters decide what it means.
      const body = (await response.json().catch(() => null)) as unknown;

      return {
        status: response.status,
        body,
        retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
      };
    },
  };
}
