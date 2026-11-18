import type { ApiErrorCode } from '@quickbiz/shared';

/**
 * Application error with a stable machine-readable code.
 * `message` is safe to show to users; internal details stay in logs.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
  }

  static badRequest(message = 'The request could not be understood.', details?: unknown) {
    return new AppError('BAD_REQUEST', 400, message, details);
  }

  static validation(details?: unknown, message = 'Some fields need attention.') {
    return new AppError('VALIDATION_ERROR', 422, message, details);
  }

  static unauthorized(message = 'You need to sign in to continue.') {
    return new AppError('UNAUTHORIZED', 401, message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new AppError('FORBIDDEN', 403, message);
  }

  static notFound(message = 'That resource was not found.') {
    return new AppError('NOT_FOUND', 404, message);
  }

  static conflict(message = 'That action conflicts with the current state.') {
    return new AppError('CONFLICT', 409, message);
  }

  static rateLimited(message = 'Too many requests. Please slow down.', retryAfterSeconds = 60) {
    return new AppError('RATE_LIMITED', 429, message, { retryAfterSeconds });
  }

  static payloadTooLarge(message = 'That request is too large.') {
    return new AppError('PAYLOAD_TOO_LARGE', 413, message);
  }

  static internal(message = 'Something went wrong on our side.') {
    return new AppError('INTERNAL_ERROR', 500, message);
  }

  static unavailable(message = 'The service is temporarily unavailable.') {
    return new AppError('SERVICE_UNAVAILABLE', 503, message);
  }

  static provider(message = 'The AI service could not complete that request.') {
    return new AppError('PROVIDER_ERROR', 502, message);
  }

  static notImplemented(message = 'This feature is not available yet.') {
    return new AppError('NOT_IMPLEMENTED', 501, message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
