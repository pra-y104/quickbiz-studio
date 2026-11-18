import { z } from 'zod';

/**
 * Browser environment. Only VITE_* values exist here, so nothing secret can leak
 * into the bundle. Empty strings are treated as "not configured".
 */
const publicEnvSchema = z.object({
  apiBaseUrl: z.string().min(1),
  appVersion: z.string().min(1),
});

export interface PublicEnv {
  readonly apiBaseUrl: string;
  readonly appVersion: string;
}

function readEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787',
    appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0',
  });

  if (!parsed.success) {
    throw new Error('Invalid public environment configuration for the web app.');
  }

  return parsed.data;
}

export const env: PublicEnv = readEnv();
