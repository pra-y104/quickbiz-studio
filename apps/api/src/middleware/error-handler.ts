import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { fail } from '../lib/response';
import { resolveSentryReporter, type SentryReporter } from '../monitoring';
import type { Bindings } from '../config/env';
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

// Resolve the reporter once per bindings object; a no-op when SENTRY_DSN is unset.
const reporterCache = new WeakMap<object, SentryReporter>();
function reporterFor(c: Parameters<ErrorHandler<AppContext>>[1]): SentryReporter {
  try {
    const env = c.env as Bindings;
    let reporter = reporterCache.get(env as object);
    if (!reporter) {
      reporter = resolveSentryReporter(env);
      reporterCache.set(env as object, reporter);
    }
    return reporter;
  } catch {
    return { isConfigured: () => false, captureException: () => undefined };
  }
}

/** Report a server-side failure to monitoring without ever throwing. */
function report(c: Parameters<ErrorHandler<AppContext>>[1], error: unknown, message: string): void {
  try {
    reporterFor(c).captureException(error, {
      level: 'error',
      message,
      tags: { path: safePath(c) },
      extra: { requestId: safeRequestId(c) },
    });
  } catch {
    // Monitoring must never affect the response.
  }
}

function safePath(c: Parameters<ErrorHandler<AppContext>>[1]): string {
  try {
    return new URL(c.req.url).pathname;
  } catch {
    return 'unknown';
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
    if (error.status >= 500) {
      report(c, error, `AppError ${error.code}: ${error.message}`);
    }
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

  report(c, error, error instanceof Error ? error.message : String(error));

  return fail(c, { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' }, 500);
};

export function notFoundHandler(c: Parameters<typeof fail>[0]) {
  return fail(c, { code: 'NOT_FOUND', message: 'That endpoint does not exist.' }, 404);
}

export function isProductionError(error: unknown): boolean {
  return error instanceof AppError && error.status >= 500;
}
