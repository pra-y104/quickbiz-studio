import { AUTH_COPY } from '../../content/auth';
import { AuthFailure, type AuthFailureCode } from './types';

const CODE_MESSAGES: Readonly<Record<AuthFailureCode, string>> = {
  invalid_credentials: AUTH_COPY.errors.generic,
  email_not_verified: AUTH_COPY.login.unverified,
  already_registered: AUTH_COPY.errors.generic,
  weak_password: AUTH_COPY.errors.weakPassword,
  same_password: AUTH_COPY.errors.samePassword,
  rate_limited: AUTH_COPY.errors.rateLimited,
  expired_link: AUTH_COPY.errors.expiredLink,
  not_configured: AUTH_COPY.errors.notConfigured,
  network: AUTH_COPY.errors.network,
  unknown: AUTH_COPY.errors.generic,
};

/** Turn any thrown value into a message that is safe to show to a person. */
export function messageForAuthError(error: unknown): string {
  if (error instanceof AuthFailure) {
    return CODE_MESSAGES[error.code];
  }
  return AUTH_COPY.errors.generic;
}

/** Field-level message for sign-in, where the cause is usually credentials. */
export function messageForSignInError(error: unknown): string {
  if (error instanceof AuthFailure && error.code === 'invalid_credentials') {
    return AUTH_COPY.login.invalid;
  }
  return messageForAuthError(error);
}
