import type { Context } from 'hono';
import type { ApiErrorCode } from '@quickbiz/shared';
import type { AppContext } from '../types/context';

export interface FailurePayload {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/** Success envelope: { data, requestId }. */
export function ok<T>(c: Context<AppContext>, data: T, status: 200 | 201 = 200) {
  return c.json({ data, requestId: c.get('requestId') ?? 'unknown' }, status);
}

/** Failure envelope: { error: { code, message, details?, requestId } }. */
export function fail(c: Context<AppContext>, payload: FailurePayload, status: number) {
  const requestId = c.get('requestId');
  return c.json(
    {
      error: {
        code: payload.code,
        message: payload.message,
        ...(payload.details === undefined ? {} : { details: payload.details }),
        ...(requestId ? { requestId } : {}),
      },
    },
    status as 400,
  );
}
