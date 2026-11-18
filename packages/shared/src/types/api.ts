/** Every API response uses the same envelope so client error handling stays uniform. */
export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'PROVIDER_ERROR',
  'NOT_IMPLEMENTED',
  'NETWORK_ERROR',
  'INVALID_RESPONSE',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: unknown;
  readonly requestId?: string;
}

export interface ApiSuccess<T> {
  readonly data: T;
  readonly requestId: string;
}

export interface ApiFailure {
  readonly error: ApiErrorBody;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export function isApiFailure(body: unknown): body is ApiFailure {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ApiFailure).error === 'object'
  );
}
