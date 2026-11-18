import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { fail } from '../lib/response';
import type { ApiErrorCode } from '@quickbiz/shared';
import type { AppContext } from '../types/context';

const STATUS_CODES: Readonly<Record<number, ApiErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  501: 'NOT_IMPLEMENTED',
  503: 'SERVICE_UNAVAILABLE',
};

function safeRequestId(c: Parameters<ErrorHandler<AppContext>>[1]): string | undefined {
  try {
    return c.get('requestId');
  } catch {
    return undefined;
  }
}

/**
 * Central error boundary. Client-safe messages only; stacks and internal
 * details stay in the logs.
 */
export const errorHandler: ErrorHandler<AppContext> = (error, c) => {
  const requestId = safeRequestId(c);

  if (isAppError(error)) {
    const log = error.status >= 500 ? logger.error : logger.warn;
    log('request.failed', {
      requestId,
      code: error.code,
      status: error.status,
      message: error.message,
      ...(error.status >= 500 && error.stack ? { stack: error.stack } : {}),
    });
    return fail(
      c,
      { code: error.code, message: error.message, details: error.details },
      error.status,
    );
  }

  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    logger.warn('request.failed', { requestId, code: 'VALIDATION_ERROR', issues });
    return fail(
      c,
      { code: 'VALIDATION_ERROR', message: 'Some fields need attention.', details: issues },
      422,
    );
  }

  if (error instanceof HTTPException) {
    const status = error.status;
    const code = STATUS_CODES[status] ?? 'INTERNAL_ERROR';
    const message = status < 500 ? error.message : 'Something went wrong on our side.';
    logger.warn('request.failed', { requestId, code, status });
    return fail(c, { code, message }, status);
  }

  logger.error('request.failed', {
    requestId,
    code: 'INTERNAL_ERROR',
    status: 500,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  });

  return fail(c, { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' }, 500);
};

export function notFoundHandler(c: Parameters<typeof fail>[0]) {
  return fail(c, { code: 'NOT_FOUND', message: 'That endpoint does not exist.' }, 404);
}

export function isProductionError(error: unknown): boolean {
  return error instanceof AppError && error.status >= 500;
}
