import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testEnv } from './test-env';

interface ToolsResponse {
  data: {
    tools: Array<{ slug: string; kind: string; creditCost: number | null }>;
    total: number;
  };
}

describe('GET /api/v1/tools', () => {
  it('returns the full catalogue', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/tools', {}, testEnv());
    const body = (await response.json()) as ToolsResponse;

    expect(response.status).toBe(200);
    expect(body.data.total).toBe(body.data.tools.length);
    expect(body.data.tools.some((tool) => tool.slug === 'ai-writer')).toBe(true);
  });

  it('filters by kind', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/tools?kind=utility', {}, testEnv());
    const body = (await response.json()) as ToolsResponse;

    expect(response.status).toBe(200);
    expect(body.data.tools.every((tool) => tool.kind === 'utility')).toBe(true);
  });

  it('searches by name', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/tools?q=invoice', {}, testEnv());
    const body = (await response.json()) as ToolsResponse;

    expect(body.data.tools.map((tool) => tool.slug)).toContain('invoice-maker');
  });

  it('rejects invalid filters with a validation envelope', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/tools?kind=robot', {}, testEnv());
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ path: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details[0]?.path).toBe('kind');
  });
});
