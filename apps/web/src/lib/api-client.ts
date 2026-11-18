import { isApiFailure, type ApiErrorCode } from '@quickbiz/shared';

/** Client-side error with a stable code the UI can translate into a message. */
export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    extra: { requestId?: string; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: extra.cause });
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    if (extra.requestId) this.requestId = extra.requestId;
    if (extra.details !== undefined) this.details = extra.details;
  }
}

const STATUS_TO_CODE: Readonly<Record<number, ApiErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  501: 'NOT_IMPLEMENTED',
  502: 'PROVIDER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  /** Bearer token for authenticated calls (Stage 4+). */
  readonly token?: string | null;
}

export interface ApiClientConfig {
  readonly baseUrl: string;
  readonly getToken?: () => string | null;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ): Promise<T>;
}

/**
 * Thin, typed wrapper around fetch.
 *
 * Responsibilities: build URLs, attach auth, enforce the shared response
 * envelope, and convert every failure into an ApiRequestError. It never decides
 * business rules or prices - those live on the server.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, signal, token } = options;
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const authToken = token ?? config.getToken?.() ?? null;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiRequestError(
        'NETWORK_ERROR',
        0,
        'Could not reach QuickBiz Studio. Check your connection and try again.',
        { cause: error },
      );
    }

    if (response.status === 204) return undefined as T;

    const raw = await response.text();
    let payload: unknown;
    try {
      payload = raw.length > 0 ? JSON.parse(raw) : undefined;
    } catch (error) {
      throw new ApiRequestError(
        'INVALID_RESPONSE',
        response.status,
        'Unexpected server response.',
        {
          cause: error,
        },
      );
    }

    if (!response.ok || isApiFailure(payload)) {
      if (isApiFailure(payload)) {
        throw new ApiRequestError(payload.error.code, response.status, payload.error.message, {
          requestId: payload.error.requestId,
          details: payload.error.details,
        });
      }
      throw new ApiRequestError(
        STATUS_TO_CODE[response.status] ?? 'INTERNAL_ERROR',
        response.status,
        'The request could not be completed.',
        { requestId: response.headers.get('x-request-id') ?? undefined },
      );
    }

    if (typeof payload === 'object' && payload !== null && 'data' in payload) {
      return (payload as { data: T }).data;
    }

    throw new ApiRequestError('INVALID_RESPONSE', response.status, 'Unexpected server response.');
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  };
}
