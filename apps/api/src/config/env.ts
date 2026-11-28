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
  /**
   * Optional Cloudflare KV namespace binding used by the rate limiter.
   * When present, the API uses a shared store instead of the per-isolate default.
   * Typed structurally so tests can inject a fake without a real binding.
   */
  readonly RATE_LIMIT_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
  /** Server-only, reserved for Stage 7 privileged database work. */
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Server-only. Reserved for Stage 6+. */
  readonly AI_PROVIDER?: string;
  /** Server-only. Preferred model id for the requested provider. */
  readonly AI_MODEL?: string;
  readonly AI_API_KEY?: string;
  /**
   * Master switch for every AI adapter. Adapters are configured only when this is
   * exactly `true` **and** a credential is present, so a stray key cannot start
   * billable traffic. Defaults to false (fail closed).
   */
  readonly AI_ENABLED?: string;
  /** Server-only. Google AI Studio key for the Gemini adapter. */
  readonly GEMINI_API_KEY?: string;
  /** Server-only. Base URL of a Chat-Completions-compatible provider. */
  readonly AI_OPENAI_BASE_URL?: string;
  /** Server-only. Key for the OpenAI-compatible provider. */
  readonly AI_OPENAI_API_KEY?: string;
  /** Server-only. Model id for the OpenAI-compatible provider. */
  readonly AI_OPENAI_MODEL?: string;
  /** Server-only. Registry id for the OpenAI-compatible provider (default `openai`). */
  readonly AI_OPENAI_PROVIDER_ID?: string;
  /** Server-only. Display label for the OpenAI-compatible provider. */
  readonly AI_OPENAI_LABEL?: string;
  /** Server-only. Paystack secret key. Only `sk_test_` is honoured. */
  readonly PAYSTACK_SECRET_KEY?: string;
  /** Server-only. Paystack API base override (tests). */
  readonly PAYSTACK_BASE_URL?: string;
  /** Optional Cloudflare KV namespace binding for the shared AI quota store. */
  readonly AI_QUOTA_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  };
  /**
   * Require a verified email before AI runs. Defaults to true and fails closed:
   * a token without an `email_verified` claim is treated as unverified.
   */
  readonly AI_REQUIRE_VERIFIED_EMAIL?: string;
  /** Server-only. Resend API key for transactional email. */
  readonly RESEND_API_KEY?: string;
  /** Server-only. Verified Resend sender, e.g. `QuickBiz <noreply@example.com>`. */
  readonly RESEND_FROM_EMAIL?: string;
  /** Server-only. Resend API base override (tests only). */
  readonly RESEND_BASE_URL?: string;
  /** Server-only. Sentry DSN for API error monitoring. */
  readonly SENTRY_DSN?: string;
  /** Server-only. Sentry environment label (defaults to ENVIRONMENT). */
  readonly SENTRY_ENVIRONMENT?: string;
  /** Server-only. Sentry release label (defaults to APP_VERSION). */
  readonly SENTRY_RELEASE?: string;
  /**
   * Server-only. Comma-separated allow-list of admin user ids (Supabase `sub`).
   * A caller is an admin only when their verified token matches this list or
   * `ADMIN_EMAILS`. Empty means nobody is an admin (fail closed). Users cannot
   * change these values, so they can never promote themselves.
   */
  readonly ADMIN_USER_IDS?: string;
  /** Server-only. Comma-separated allow-list of admin email addresses. */
  readonly ADMIN_EMAILS?: string;
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
    /**
     * Shared KV namespace for distributed rate limiting, or null to use the
     * per-isolate in-memory default. KV is eventually consistent; see
     * `rate-limit-store.ts` for the exact consistency tradeoff.
     */
    readonly kvNamespace: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    } | null;
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
    /** Fail-closed switch: AI runs require a verified email unless disabled. */
    readonly requireVerifiedEmail: boolean;
  };
  /**
   * Admin allow-list resolved from the environment. A request is authorized as
   * admin only when the verified token's user id or email appears here. Empty
   * lists mean no admins exist (fail closed).
   */
  readonly admin: {
    readonly userIds: readonly string[];
    readonly emails: readonly string[];
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

/** Split a comma-separated env value into a trimmed, de-duplicated list. */
function toList(value: string | undefined): string[] {
  if (!value) return [];
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return [...new Set(items)];
}

const stringList = z
  .string()
  .optional()
  .transform((value) => toList(value));

const emailList = z
  .string()
  .optional()
  .transform((value) => toList(value).map((email) => email.toLowerCase()));

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
  AI_REQUIRE_VERIFIED_EMAIL: z.enum(['true', 'false']).default('true'),
  /** Preferred provider/model. Not a capability switch: see `AppConfig.ai`. */
  AI_PROVIDER: nullableIdentifier,
  AI_MODEL: nullableModelId,
  /** Admin allow-lists. Empty means no admins (fail closed). */
  ADMIN_USER_IDS: stringList,
  ADMIN_EMAILS: emailList,
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
      kvNamespace: (bindings as Bindings).RATE_LIMIT_KV ?? null,
    },
    ai: {
      providerId: parsed.AI_PROVIDER,
      model: parsed.AI_MODEL,
      requireVerifiedEmail: parsed.AI_REQUIRE_VERIFIED_EMAIL === 'true',
    },
    admin: {
      userIds: parsed.ADMIN_USER_IDS,
      emails: parsed.ADMIN_EMAILS,
    },
  };

  configCache.set(bindings as object, config);
  return config;
}
