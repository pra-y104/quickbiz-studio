import { describe, expect, it } from 'vitest';
import { AiProviderRegistry, describeAiAvailability, productionRegistry } from '../ai/registry';
import { AiProviderError } from '../ai/provider';
import { FakeProvider } from '../ai/testing/fake-provider';
import { resolveConfig } from '../config/env';
import { createApp } from '../app';
import { testEnv } from './test-env';

describe('AiProviderRegistry', () => {
  it('registers, retrieves and lists adapters', () => {
    const registry = new AiProviderRegistry();
    const provider = new FakeProvider();

    registry.register(provider);

    expect(registry.get('fake')).toBe(provider);
    expect(registry.list()).toEqual([provider]);
    expect(registry.configured()).toEqual([provider]);
  });

  it('rejects duplicate ids and malformed ids', () => {
    const registry = new AiProviderRegistry();
    registry.register(new FakeProvider());

    expect(() => registry.register(new FakeProvider())).toThrow(/already registered/);
    expect(() => registry.register(new FakeProvider({ id: 'Not Valid' }))).toThrow(/Invalid/);
  });

  it('excludes adapters without a usable credential from configured()', () => {
    const registry = new AiProviderRegistry();
    registry.register(new FakeProvider({ configured: false }));

    expect(registry.list()).toHaveLength(1);
    expect(registry.configured()).toHaveLength(0);
  });

  it('require() fails closed for missing or unconfigured providers', () => {
    const registry = new AiProviderRegistry();

    expect(() => registry.require('fake')).toThrow(AiProviderError);
    expect(() => registry.require('fake')).toThrow(/No AI provider is configured/);

    registry.register(new FakeProvider({ configured: false }));
    expect(() => registry.require('fake')).toThrow(AiProviderError);
  });
});

describe('describeAiAvailability', () => {
  it('reports unavailable with an empty registry, even when a provider is named', () => {
    const config = resolveConfig(testEnv({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-flash' }));
    const availability = describeAiAvailability(config, new AiProviderRegistry());

    expect(availability).toEqual({
      configured: false,
      reason: 'no-adapters-registered',
      requestedProvider: 'gemini',
      model: 'gemini-flash',
    });
  });

  it('reports provider-not-configured when an adapter has no credential', () => {
    const registry = new AiProviderRegistry();
    registry.register(new FakeProvider({ configured: false }));

    const availability = describeAiAvailability(resolveConfig(testEnv()), registry);
    expect(availability.configured).toBe(false);
    expect(availability.reason).toBe('provider-not-configured');
  });

  it('reports ready only when a registered adapter is configured', () => {
    const registry = new AiProviderRegistry();
    registry.register(new FakeProvider());

    const availability = describeAiAvailability(resolveConfig(testEnv()), registry);
    expect(availability.configured).toBe(true);
    expect(availability.reason).toBe('ready');
  });

  it('does not let a different configured adapter make the requested one ready', () => {
    const registry = new AiProviderRegistry();
    registry.register(new FakeProvider({ id: 'alpha' }));

    const availability = describeAiAvailability(
      resolveConfig(testEnv({ AI_PROVIDER: 'beta' })),
      registry,
    );

    expect(availability.configured).toBe(false);
    expect(availability.reason).toBe('provider-not-configured');
    expect(availability.requestedProvider).toBe('beta');
  });

  it('reports ready only for the requested provider', () => {
    const registry = new AiProviderRegistry();
    registry.register(new FakeProvider({ id: 'alpha' }));
    registry.register(new FakeProvider({ id: 'beta' }));

    const availability = describeAiAvailability(
      resolveConfig(testEnv({ AI_PROVIDER: 'beta', AI_MODEL: 'model-b' })),
      registry,
    );

    expect(availability).toMatchObject({
      configured: true,
      reason: 'ready',
      requestedProvider: 'beta',
      model: 'model-b',
    });
  });

  it('keeps the requested provider unavailable when it exists but has no credential', () => {
    const registry = new AiProviderRegistry();
    registry.register(new FakeProvider({ id: 'alpha' }));
    registry.register(new FakeProvider({ id: 'beta', configured: false }));

    const availability = describeAiAvailability(
      resolveConfig(testEnv({ AI_PROVIDER: 'beta' })),
      registry,
    );

    expect(availability.configured).toBe(false);
    expect(availability.reason).toBe('provider-not-configured');
  });
});

describe('AI configuration safety', () => {
  it('fails closed for an invalid provider id without leaking the value', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/ai/status',
      {},
      testEnv({ AI_PROVIDER: 'Gemini Pro!' }),
    );
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain('INTERNAL_ERROR');
    expect(text).not.toContain('Gemini Pro!');
  });

  it('never returns keys or secrets from the status endpoint', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/ai/status',
      {},
      testEnv({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-flash', AI_API_KEY: 'super-secret' }),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain('super-secret');
    expect(text).not.toMatch(/api[_-]?key|secret/i);
  });
});

describe('production registry', () => {
  it('contains no real provider', () => {
    expect(productionRegistry.list()).toHaveLength(0);
    expect(productionRegistry.configured()).toHaveLength(0);
  });

  it('keeps the status endpoint unavailable', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/ai/status', {}, testEnv());
    const body = (await response.json()) as {
      data: { configured: boolean; reason: string; quota: null };
    };

    expect(response.status).toBe(200);
    expect(body.data.configured).toBe(false);
    expect(body.data.reason).toBe('no-adapters-registered');
    expect(body.data.quota).toBeNull();
  });
});
