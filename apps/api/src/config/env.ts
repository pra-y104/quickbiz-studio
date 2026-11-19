import { z } from 'zod';
import { AI_PROVIDER_ID_PATTERN } from '@quickbiz/shared';

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
  /** Server-only. Used to derive the JWKS endpoint and token issuer. */
  readonly SUPABASE_URL?: string;
  /** Server-only. Explicit JWKS override for non-standard deployments. */
  readonly SUPABASE_JWKS_URL?: string;
  /** Legacy HS256 shared secret. Server-only; never exposed to the browser. */
  readonly SUPABASE_JWT_SECRET?: string;
  /** Server-only, reserved for Stage 7 privileged database work. */
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Server-only. Reserved for Stage 6+. */
  readonly AI_PROVIDER?: string;
  /** Server-only. Preferred model id for the requested provider. */
  readonly AI_MODEL?: string;
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
  /**
   * Requested AI provider and model, if the environment names them.
   *
   * These values are a preference, never proof that the feature works: an
   * adapter must also be compiled in. No adapter exists in this build, so
   * `/api/v1/ai/status` reports the feature as unavailable regardless of these
   * values. Keys and quota limits are intentionally not part of this object.
   */
  readonly ai: {
    readonly providerId: string | null;
    readonly model: string | null;
  };
}

/** Empty string from a var or secret means "not set", not "set to empty". */
const nullableIdentifier = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value.length === 0 ? null : value))
  .refine((value) => value === null || AI_PROVIDER_ID_PATTERN.test(value), {
    message: 'must be a lowercase identifier of at most 40 characters',
  });

const nullableModelId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value.length === 0 ? null : value))
  .refine((value) => value === null || /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value), {
    message: 'must be a model id of at most 120 characters',
  });

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
  /** Preferred provider/model. Not a capability switch: see `AppConfig.ai`. */
  AI_PROVIDER: nullableIdentifier,
  AI_MODEL: nullableModelId,
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
    ai: {
      providerId: parsed.AI_PROVIDER,
      model: parsed.AI_MODEL,
    },
  };

  configCache.set(bindings as object, config);
  return config;
}
