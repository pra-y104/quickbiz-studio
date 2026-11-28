import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AuthTokenError,
  resolveAuthTokenConfig,
  verifyAccessToken,
  type AuthTokenConfig,
} from '../lib/auth-tokens';
import { testEnv } from './test-env';

const ISSUER = 'https://nrlldorsixhxvwzgzofn.supabase.co/auth/v1';
const JWKS_URL = 'https://nrlldorsixhxvwzgzofn.supabase.co/auth/v1/.well-known/jwks.json';

let keypair: Awaited<ReturnType<typeof generateKeyPair>>;
let kid: string;

beforeAll(async () => {
  keypair = await generateKeyPair('ES256');
  kid = 'test-kid-1';
  const jwk = { ...(await exportJWK(keypair.publicKey)), kid, alg: 'ES256', use: 'sig' };

  // Serve the JWKS via a stubbed global fetch (the Workers runtime has no
  // node:http). createRemoteJWKSet fetches this URL internally.
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function config(): AuthTokenConfig {
  return { kind: 'jwks', jwksUrl: JWKS_URL, issuer: ISSUER };
}

async function mint(
  overrides: { audience?: string; issuer?: string; expiresIn?: string } = {},
): Promise<string> {
  const { audience = 'authenticated', issuer = ISSUER, expiresIn = '1h' } = overrides;
  return new SignJWT({ email: 'user@example.com', role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setSubject('user-1')
    .setAudience(audience)
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(keypair.privateKey);
}

describe('JWKS access-token verification', () => {
  it('verifies a well-formed Supabase-style ES256 token', async () => {
    const claims = await verifyAccessToken(await mint(), config());
    expect(claims.userId).toBe('user-1');
    expect(claims.role).toBe('authenticated');
  });

  it('rejects a token with the wrong issuer as invalid', async () => {
    const token = await mint({ issuer: 'https://other.supabase.co/auth/v1' });
    await expect(verifyAccessToken(token, config())).rejects.toMatchObject({ reason: 'invalid' });
  });

  it('rejects a token with the wrong audience as invalid', async () => {
    const token = await mint({ audience: 'anon' });
    await expect(verifyAccessToken(token, config())).rejects.toMatchObject({ reason: 'invalid' });
  });

  it('reports a clearly expired token as expired (beyond clock tolerance)', async () => {
    const token = await mint({ expiresIn: '-120s' });
    await expect(verifyAccessToken(token, config())).rejects.toMatchObject({ reason: 'expired' });
  });

  it('throws AuthTokenError (not a raw error) on failure', async () => {
    await expect(verifyAccessToken('not-a-jwt', config())).rejects.toBeInstanceOf(AuthTokenError);
  });
});

describe('resolveAuthTokenConfig', () => {
  it('prefers JWKS (asymmetric) when SUPABASE_URL is set, even if a legacy secret exists', () => {
    const resolved = resolveAuthTokenConfig(
      testEnv({
        SUPABASE_URL: 'https://nrlldorsixhxvwzgzofn.supabase.co',
        SUPABASE_JWT_SECRET: 'a-legacy-secret-value-long-enough',
      }),
    );
    expect(resolved.kind).toBe('jwks');
    if (resolved.kind === 'jwks') {
      expect(resolved.jwksUrl).toBe(JWKS_URL);
      expect(resolved.issuer).toBe(ISSUER);
    }
  });

  it('is unconfigured when neither URL nor secret is present', () => {
    expect(resolveAuthTokenConfig(testEnv()).kind).toBe('none');
  });
});
