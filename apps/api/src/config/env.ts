import { z } from 'zod';

/**
 * Worker environment contract. Values arrive as strings from wrangler vars and
 * `wrangler secret put`, so they are validated and coerced once per isolate.
 */
export interface Bindings {
  readonly ENVIRONMENT?: string;
  readonly APP_VERSION?: string;
  readonly ALLOWED_ORIGINS?: string;
  readonly RATE_LIMIT_ENABLED?: string;
  readonly RATE_LIMIT_WINDOW_SECONDS?: string;
  readonly RATE_LIMIT_MAX_REQUESTS?: string;
  /** Server-only. Reserved for Stage 4+ and never sent to the browser. */
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Server-only. Reserved for Stage 6+. */
  readonly AI_PROVIDER?: string;
  readonly AI_API_KEY?: string;
}

export const ENVIRONMENTS = ['development', 'preview', 'production'] as const;
export type AppEnvironment = (typeof ENVIRONMENTS)[number];

export interface AppConfig {
  readonly environment: AppEnvironment;
  readonly appVersion: string;
  readonly allowedOrigins: readonly string[];
  readonly isProduction: boolean;
  readonly rateLimit: {
    readonly enabled: boolean;
    readonly windowSeconds: number;
    readonly maxRequests: number;
  };
}

const rawEnvSchema = z.object({
  ENVIRONMENT: z.enum(ENVIRONMENTS).default('development'),
  APP_VERSION: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, 'APP_VERSION must be semver')
    .default('0.1.0'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10_000).default(120),
});

/** Cache keyed by the env object so parsing happens once per isolate. */
const configCache = new WeakMap<object, AppConfig>();

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function resolveConfig(bindings: Bindings): AppConfig {
  const cached = configCache.get(bindings as object);
  if (cached) return cached;

  const result = rawEnvSchema.safeParse(bindings);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new ConfigurationError(`Invalid worker configuration: ${issues.join('; ')}`);
  }

  const parsed = result.data;
  const config: AppConfig = {
    environment: parsed.ENVIRONMENT,
    appVersion: parsed.APP_VERSION,
    allowedOrigins: parsed.ALLOWED_ORIGINS,
    isProduction: parsed.ENVIRONMENT === 'production',
    rateLimit: {
      enabled: parsed.RATE_LIMIT_ENABLED === 'true',
      windowSeconds: parsed.RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: parsed.RATE_LIMIT_MAX_REQUESTS,
    },
  };

  configCache.set(bindings as object, config);
  return config;
}
