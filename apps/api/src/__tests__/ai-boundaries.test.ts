import { describe, expect, it } from 'vitest';
import { TOOL_CATALOGUE, isToolExecutable } from '@quickbiz/shared';
import * as aiModule from '../ai';
import { productionRegistry } from '../ai/registry';
import { createApp } from '../app';
import apiPackage from '../../package.json';
import { testEnv } from './test-env';

describe('production isolation', () => {
  it('contains no provider in the production registry', () => {
    expect(productionRegistry.list()).toHaveLength(0);
    expect(productionRegistry.configured()).toHaveLength(0);
  });

  it('does not expose a test double from the production barrel', () => {
    expect(Object.keys(aiModule)).not.toContain('FakeProvider');
    expect('FakeProvider' in aiModule).toBe(false);
  });

  it('declares no provider SDK dependency', () => {
    const installed = Object.keys({
      ...apiPackage.dependencies,
      ...apiPackage.devDependencies,
    });
    const forbidden = ['openai', '@google/generative-ai', '@anthropic-ai/sdk', 'groq-sdk', 'axios'];

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

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_IMPLEMENTED' } });
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
