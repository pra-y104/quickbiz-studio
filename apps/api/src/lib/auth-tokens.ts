import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Bindings } from '../config/env';
import { logger } from './logger';

/**
 * Access-token verification for Supabase-issued JWTs.
 *
 * Two supported modes, chosen by configuration:
 *  - `jwks`   - current Supabase projects sign with asymmetric keys (ES256/RS256)
 *               published at <project>/auth/v1/.well-known/jwks.json.
 *  - `secret` - legacy shared HS256 secret, still used by older projects and by
 *               tests, where tokens are minted locally.
 *
 * If neither is configured the API refuses protected requests instead of
 * pretending a caller is authenticated.
 */
export type AuthTokenConfig =
  | { readonly kind: 'jwks'; readonly jwksUrl: string; readonly issuer?: string }
  | { readonly kind: 'secret'; readonly secret: Uint8Array; readonly issuer?: string }
  | { readonly kind: 'none' };

export interface AuthClaims {
  readonly userId: string;
  readonly email: string | null;
  readonly role: string;
  readonly sessionId: string | null;
  /** Unix seconds. */
  readonly expiresAt: number;
  /**
   * Whether the token asserts a verified email.
   *
   * `undefined` means the token carries no such claim. Callers that require
   * verification must treat that as unverified rather than guessing.
   */
  readonly emailVerified: boolean | undefined;
}

export type AuthTokenErrorReason = 'missing' | 'expired' | 'invalid' | 'unconfigured';

export class AuthTokenError extends Error {
  readonly reason: AuthTokenErrorReason;

  constructor(reason: AuthTokenErrorReason, message: string) {
    super(message);
    this.name = 'AuthTokenError';
    this.reason = reason;
  }
}

const configCache = new WeakMap<object, AuthTokenConfig>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Host of a URL, or null — safe to log (never a secret). */
function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * A safe, non-sensitive summary of the resolved verification configuration.
 * Logs which mode is active and the public hosts involved — never the URL path
 * of a secret, tokens, keys or any personal data.
 */
function describeConfig(config: AuthTokenConfig): Record<string, unknown> {
  if (config.kind === 'jwks') {
    return {
      mode: 'jwks',
      jwksHost: hostOf(config.jwksUrl),
      issuerConfigured: Boolean(config.issuer),
      algorithms: ['ES256', 'RS256'],
    };
  }
  if (config.kind === 'secret') {
    return { mode: 'secret', issuerConfigured: Boolean(config.issuer), algorithms: ['HS256'] };
  }
  return { mode: 'none' };
}

export function resolveAuthTokenConfig(bindings: Bindings): AuthTokenConfig {
  const cached = configCache.get(bindings as object);
  if (cached) return cached;

  const supabaseUrl = bindings.SUPABASE_URL?.trim();
  const jwksUrl = bindings.SUPABASE_JWKS_URL?.trim();
  const secret = bindings.SUPABASE_JWT_SECRET?.trim();
  const issuer = supabaseUrl ? `${trimTrailingSlash(supabaseUrl)}/auth/v1` : undefined;

  let config: AuthTokenConfig = { kind: 'none' };

  if (jwksUrl) {
    config = { kind: 'jwks', jwksUrl, ...(issuer ? { issuer } : {}) };
  } else if (supabaseUrl) {
    config = {
      kind: 'jwks',
      jwksUrl: `${trimTrailingSlash(supabaseUrl)}/auth/v1/.well-known/jwks.json`,
      issuer,
    };
  } else if (secret && secret.length >= 16) {
    config = {
      kind: 'secret',
      secret: new TextEncoder().encode(secret),
      ...(issuer ? { issuer } : {}),
    };
  }

  // Log the resolved mode once per configuration (cache miss). This never
  // includes secrets, tokens or personal data — only the mode and public hosts.
  if (config.kind === 'none') {
    logger.warn('auth.config.unconfigured', {});
  } else {
    logger.info('auth.config.resolved', describeConfig(config));
  }

  configCache.set(bindings as object, config);
  return config;
}

function toClaims(payload: JWTPayload): AuthClaims {
  const subject = typeof payload.sub === 'string' ? payload.sub : '';
  if (!subject) {
    throw new AuthTokenError('invalid', 'Token has no subject');
  }
  return {
    userId: subject,
    email: typeof payload.email === 'string' ? payload.email : null,
    role: typeof payload.role === 'string' ? payload.role : 'authenticated',
    sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
    expiresAt: typeof payload.exp === 'number' ? payload.exp : 0,
    emailVerified: typeof payload.email_verified === 'boolean' ? payload.email_verified : undefined,
  };
}

export async function verifyAccessToken(
  token: string,
  config: AuthTokenConfig,
): Promise<AuthClaims> {
  if (config.kind === 'none') {
    throw new AuthTokenError('unconfigured', 'Authentication is not configured on this server');
  }

  // Small clock-skew tolerance: Render and Supabase clocks can differ by a few
  // seconds, which otherwise makes an otherwise-valid token fail the `nbf`/`exp`
  // checks. This does not weaken signature, issuer or audience validation.
  const options = {
    audience: 'authenticated',
    clockTolerance: 60,
    ...(config.issuer ? { issuer: config.issuer } : {}),
  };

  try {
    if (config.kind === 'secret') {
      const { payload } = await jwtVerify(token, config.secret, {
        ...options,
        algorithms: ['HS256'],
      });
      return toClaims(payload);
    }

    let jwks = jwksCache.get(config.jwksUrl);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(config.jwksUrl));
      jwksCache.set(config.jwksUrl, jwks);
    }

    const { payload } = await jwtVerify(token, jwks, {
      ...options,
      algorithms: ['ES256', 'RS256'],
    });
    return toClaims(payload);
  } catch (error) {
    if (error instanceof AuthTokenError) throw error;
    const name = error instanceof Error ? error.name : '';
    if (name === 'JWTExpired') {
      logger.warn('auth.verify.failed', { reason: 'expired' });
      throw new AuthTokenError('expired', 'Session expired');
    }
    // Categorise the failure for diagnostics without ever logging the token or
    // any personal data. `code`/`claim` come from the jose error and describe
    // the verification step that failed (signature, issuer, audience, JWKS…).
    const detail = error as { code?: unknown; claim?: unknown };
    logger.warn('auth.verify.failed', {
      reason: 'invalid',
      errorName: name || 'UnknownError',
      errorCode: typeof detail.code === 'string' ? detail.code : undefined,
      failedClaim: typeof detail.claim === 'string' ? detail.claim : undefined,
    });
    throw new AuthTokenError('invalid', 'Invalid access token');
  }
}
