import { z } from 'zod';

/**
 * Browser environment. Only VITE_* values exist here, so nothing secret can leak
 * into the bundle. Empty strings are treated as "not configured".
 */
const publicEnvSchema = z.object({
  apiBaseUrl: z.string().min(1),
  appVersion: z.string().min(1),
  supabaseUrl: z.string().min(1).nullable(),
  supabaseAnonKey: z.string().min(1).nullable(),
  sentryDsn: z.string().min(1).nullable(),
});

export interface PublicEnv {
  readonly apiBaseUrl: string;
  readonly appVersion: string;
  /** Public Supabase project URL, or null when auth is not configured. */
  readonly supabaseUrl: string | null;
  /** Public anon key. Never the service-role key. */
  readonly supabaseAnonKey: string | null;
  /** Public Sentry DSN, or null when monitoring is not configured. */
  readonly sentryDsn: string | null;
}

/**
 * Remove invisible Unicode formatting characters (the "Cf" general category:
 * zero-width spaces, joiners and bidi marks such as U+200E LEFT-TO-RIGHT MARK)
 * and surrounding whitespace.
 *
 * These characters are easy to introduce when a value is copied and pasted into
 * a dashboard field. They survive `String.prototype.trim()` (they are not
 * ECMAScript whitespace) but break strict parsers such as `new URL(...)`, which
 * made a pasted Supabase URL throw at startup and blank the whole page.
 */
export function stripInvisible(value: string): string {
  return value.replace(/\p{Cf}/gu, '').trim();
}

/**
 * Normalise an optional value: strip invisible characters, then treat an empty
 * result as "not configured" (null).
 */
function optional(value: string | undefined): string | null {
  const cleaned = value === undefined ? '' : stripInvisible(value);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Like `optional`, but additionally requires a valid absolute http(s) URL.
 * Anything else resolves to null so a malformed value disables the feature
 * instead of throwing during startup.
 */
function optionalHttpUrl(value: string | undefined): string | null {
  const cleaned = optional(value);
  if (cleaned === null) return null;
  try {
    const url = new URL(cleaned);
    if (url.protocol === 'http:' || url.protocol === 'https:') return cleaned;
  } catch {
    /* Not a parseable URL — fall through and treat as unconfigured. */
  }
  return null;
}

function readEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    apiBaseUrl: stripInvisible(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'),
    appVersion: stripInvisible(import.meta.env.VITE_APP_VERSION || '0.1.0'),
    supabaseUrl: optionalHttpUrl(import.meta.env.VITE_SUPABASE_URL),
    supabaseAnonKey: optional(import.meta.env.VITE_SUPABASE_ANON_KEY),
    sentryDsn: optional(import.meta.env.VITE_SENTRY_DSN),
  });

  if (!parsed.success) {
    throw new Error('Invalid public environment configuration for the web app.');
  }

  return parsed.data;
}

export const env: PublicEnv = readEnv();

/** Authentication only works when both public Supabase values are present. */
export const isAuthConfigured = env.supabaseUrl !== null && env.supabaseAnonKey !== null;
