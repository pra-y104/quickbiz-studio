/** Absolute URLs used as Supabase redirect targets. */

function origin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** Where Supabase sends someone after they open an email confirmation link. */
export function emailCallbackUrl(): string {
  return `${origin()}/auth/callback`;
}

/** Where Supabase sends someone after they open a password recovery link. */
export function passwordRecoveryUrl(): string {
  return `${origin()}/auth/reset-password`;
}
