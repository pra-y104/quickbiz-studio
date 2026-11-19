import { describe, expect, it } from 'vitest';
import { AI_PROMPT_VERSIONS, AI_TOOL_SLUGS, type AiStatus } from '@quickbiz/shared';
import { createApp } from '../app';
import { testEnv } from './test-env';

interface StatusResponse {
  data: AiStatus;
}

async function getStatus(env = testEnv()): Promise<StatusResponse['data']> {
  const app = createApp();
  const response = await app.request('/api/v1/ai/status', {}, env);
  expect(response.status).toBe(200);
  return ((await response.json()) as StatusResponse).data;
}

describe('GET /api/v1/ai/status', () => {
  it('reports the feature as unavailable with no adapter registered', async () => {
    const body = await getStatus();

    expect(body.configured).toBe(false);
    expect(body.reason).toBe('no-adapters-registered');
    expect(body.quota).toBeNull();
  });

  it('does not become available just because a provider is named', async () => {
    const body = await getStatus(testEnv({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-2.0-flash' }));

    expect(body.configured).toBe(false);
    expect(body.reason).toBe('no-adapters-registered');
    expect(body.requestedProvider).toBe('gemini');
    expect(body.model).toBe('gemini-2.0-flash');
  });

  it('treats empty values as unset', async () => {
    const body = await getStatus(testEnv({ AI_PROVIDER: '', AI_MODEL: '' }));

    expect(body.requestedProvider).toBeNull();
    expect(body.model).toBeNull();
  });

  it('lists all eight AI tools as planned and unpriced', async () => {
    const body = await getStatus();

    expect(body.total).toBe(AI_TOOL_SLUGS.length);
    expect(body.tools.map((tool) => tool.slug).sort()).toEqual([...AI_TOOL_SLUGS].sort());
    for (const tool of body.tools) {
      expect(tool.status).toBe('planned');
      expect(tool.creditCost).toBeNull();
      expect(tool.promptVersion).toBe(AI_PROMPT_VERSIONS[tool.slug]);
    }
  });

  it('is rate-limited like the rest of the API namespace', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/ai/status',
      {},
      testEnv({ RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    expect(response.status).toBe(200);
  });
});

describe('POST /api/v1/ai/run', () => {
  it('returns 501 and never calls a provider', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/ai/run',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      testEnv(),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(501);
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });
});
