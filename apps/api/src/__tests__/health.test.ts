import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { testEnv } from './test-env';

describe('GET /health', () => {
  it('reports service status without dependencies', async () => {
    const app = createApp();
    const response = await app.request('/health', {}, testEnv());
    const body = (await response.json()) as {
      data: { status: string; service: string; version: string };
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('ok');
    expect(body.data.service).toBe('quickbiz-studio-api');
    expect(body.data.version).toBe('0.1.0');
    expect(body.requestId).toMatch(/[0-9a-f-]{36}/);
    expect(response.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('returns service metadata at the API root', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/meta', {}, testEnv());
    const body = (await response.json()) as {
      data: { name: string; apiVersion: string; toolCount: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe('QuickBiz Studio');
    expect(body.data.apiVersion).toBe('v1');
    expect(body.data.toolCount).toBeGreaterThan(0);
  });
});
