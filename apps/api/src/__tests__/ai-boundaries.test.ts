import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { TOOL_CATALOGUE, isToolExecutable } from '@quickbiz/shared';
import * as aiModule from '../ai';
import { productionRegistry } from '../ai/registry';
import { createApp } from '../app';
import apiPackage from '../../package.json';
import { testEnv } from './test-env';

const JWT_SECRET = 'test-secret-value-that-is-long-enough';
const secretKey = new TextEncoder().encode(JWT_SECRET);

async function signToken() {
  return new SignJWT({ email: 'ada@example.com', role: 'authenticated', session_id: 's1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('demo-user-id')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey);
}

describe('production isolation', () => {
  it('contains no provider in the production registry', () => {
    expect(productionRegistry.list()).toHaveLength(0);
    expect(productionRegistry.configured()).toHaveLength(0);
  });

  it('exposes production registration as a frozen read-only view', () => {
    expect('register' in productionRegistry).toBe(false);
    expect(Object.isFrozen(productionRegistry)).toBe(true);
  });

  it('does not expose a test double from the production barrel', () => {
    expect(Object.keys(aiModule)).not.toContain('FakeProvider');
    expect('FakeProvider' in aiModule).toBe(false);
  });

  it('declares no provider SDK or HTTP client dependency', () => {
    const installed = Object.keys({
      ...apiPackage.dependencies,
      ...apiPackage.devDependencies,
    });
    const forbidden = [
      'openai',
      '@google/generative-ai',
      '@anthropic-ai/sdk',
      'groq-sdk',
      'axios',
      'undici',
      'ky',
      'got',
      'node-fetch',
    ];

    expect(installed.filter((name) => forbidden.includes(name))).toEqual([]);
  });
});

describe('HTTP surface stays disabled', () => {
  it('POST /api/v1/ai/run is not an execution endpoint', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/ai/run',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool: 'ai-writer', input: {} }),
      },
      testEnv({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-flash' }),
    );

    // M2: the route exists but is authenticated and fail-closed. An anonymous
    // caller must not learn anything, and a signed-in caller gets 503 because no
    // adapter is registered.
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('fails closed with 503 for a signed-in caller while no adapter exists', async () => {
    const token = await signToken();
    const app = createApp();
    const response = await app.request(
      '/api/v1/ai/run',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tool: 'ai-writer',
          input: {
            documentType: 'email',
            topic: 'A practical guide to opening a small bakery in Lagos',
            tone: 'friendly',
            length: 'medium',
            language: 'en',
          },
        }),
      },
      testEnv({ SUPABASE_JWT_SECRET: JWT_SECRET, AI_PROVIDER: 'gemini' }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'SERVICE_UNAVAILABLE' } });
  });

  it('keeps every AI catalogue entry planned and unpriced', () => {
    const aiTools = TOOL_CATALOGUE.filter((tool) => tool.kind === 'ai');

    expect(aiTools).toHaveLength(8);
    for (const tool of aiTools) {
      expect(tool.status, tool.slug).toBe('planned');
      expect(tool.creditCost, tool.slug).toBeNull();
      expect(isToolExecutable(tool), tool.slug).toBe(false);
    }
  });
});
