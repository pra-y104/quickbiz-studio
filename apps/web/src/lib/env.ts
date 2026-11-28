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

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function readEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787',
    appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0',
    supabaseUrl: optional(import.meta.env.VITE_SUPABASE_URL),
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
