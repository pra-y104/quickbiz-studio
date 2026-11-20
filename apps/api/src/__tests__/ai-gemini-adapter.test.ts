import { describe, expect, it, vi } from 'vitest';
import { createGeminiAdapter, GEMINI_PROVISIONAL_MODEL } from '../ai/adapters/gemini';
import type { AiGenerateRequest } from '../ai/provider';
import { AiProviderError } from '../ai/provider';
import {
  AiTransportError,
  type AiJsonTransport,
  type JsonResponse,
} from '../ai/transport/http-transport';
import { productionRegistry } from '../ai/registry';

const KEY = 'test-key-not-a-real-secret';

function request(overrides: Partial<AiGenerateRequest> = {}): AiGenerateRequest {
  return {
    tool: 'ai-writer',
    system: 'You are a writer.',
    messages: [{ role: 'user', content: '<user_input>{"topic":"x"}</user_input>' }],
    temperature: 0.6,
    maxOutputTokens: 1200,
    ...overrides,
  };
}

function transportReturning(
  response: JsonResponse,
  capture?: (body: unknown, url: string, headers: Record<string, string>) => void,
) {
  const send = vi.fn(
    async (request: { url: string; headers: Record<string, string>; body: unknown }) => {
      capture?.(request.body, request.url, request.headers);
      return response;
    },
  );
  const transport: AiJsonTransport = { send };
  return { transport, send };
}

const successBody = {
  modelVersion: 'gemini-2.5-flash',
  candidates: [
    {
      content: { parts: [{ text: '{"title":"Hello","sections":[]}' }] },
      finishReason: 'STOP',
    },
  ],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 340, totalTokenCount: 460 },
};

describe('Gemini adapter: configuration', () => {
  it('is not configured without a key and never calls the transport', async () => {
    const { transport, send } = transportReturning({ status: 200, body: successBody });
    const adapter = createGeminiAdapter({ transport, apiKey: undefined });

    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.generate(request())).rejects.toMatchObject({ code: 'not-configured' });
    expect(send).not.toHaveBeenCalled();
  });

  it('treats a blank key as unconfigured', () => {
    const { transport } = transportReturning({ status: 200, body: successBody });
    expect(createGeminiAdapter({ transport, apiKey: '   ' }).isConfigured()).toBe(false);
  });

  it('is configured with a key', () => {
    const { transport } = transportReturning({ status: 200, body: successBody });
    expect(createGeminiAdapter({ transport, apiKey: KEY }).isConfigured()).toBe(true);
  });

  it('is not registered in the production registry', () => {
    expect(productionRegistry.list()).toHaveLength(0);
  });
});

describe('Gemini adapter: request construction', () => {
  it('sends the key in a header, never in the URL or body', async () => {
    let captured = { body: undefined as unknown, url: '', headers: {} as Record<string, string> };
    const { transport } = transportReturning(
      { status: 200, body: successBody },
      (body, url, headers) => {
        captured = { body, url, headers };
      },
    );

    const adapter = createGeminiAdapter({ transport, apiKey: KEY, model: 'gemini-test' });
    await adapter.generate(request());

    expect(captured.url).not.toContain(KEY);
    expect(JSON.stringify(captured.body)).not.toContain(KEY);
    expect(captured.headers['x-goog-api-key']).toBe(KEY);
    expect(captured.url).toContain('/models/gemini-test:generateContent');
  });

  it('applies the per-tool token ceiling', async () => {
    let body: unknown;
    const { transport } = transportReturning({ status: 200, body: successBody }, (value) => {
      body = value;
    });

    const adapter = createGeminiAdapter({ transport, apiKey: KEY, model: 'gemini-test' });
    await adapter.generate(request({ maxOutputTokens: 900 }));

    const payload = body as { generationConfig?: { maxOutputTokens?: number } };
    expect(payload.generationConfig?.maxOutputTokens).toBe(900);
  });
});

describe('Gemini adapter: response normalisation', () => {
  it('maps text, model, finish reason and usage', async () => {
    const { transport } = transportReturning({ status: 200, body: successBody });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });

    const result = await adapter.generate(request());

    expect(result.text).toContain('Hello');
    expect(result.providerId).toBe('gemini');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({ inputTokens: 120, outputTokens: 340, totalTokens: 460 });
  });

  it('omits usage when the provider does not report it', async () => {
    const { transport } = transportReturning({
      status: 200,
      body: { candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] },
    });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });

    const result = await adapter.generate(request());
    expect(result.usage).toBeUndefined();
  });

  it('falls back to the configured model when the provider omits it', async () => {
    const { transport } = transportReturning({
      status: 200,
      body: { candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] },
    });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });

    expect((await adapter.generate(request())).model).toBe(GEMINI_PROVISIONAL_MODEL);
  });
});

describe('Gemini adapter: failure mapping', () => {
  it('maps 429 to rate-limited and keeps the retry hint', async () => {
    const { transport } = transportReturning(
      { status: 429, body: { error: { message: 'quota' } }, retryAfterSeconds: 12 },
      undefined,
    );
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });

    await expect(adapter.generate(request())).rejects.toMatchObject({
      code: 'rate-limited',
      retryAfterSeconds: 12,
    });
  });

  it('maps 401 and 403 to not-configured', async () => {
    for (const status of [401, 403]) {
      const { transport } = transportReturning({ status, body: {} });
      const adapter = createGeminiAdapter({ transport, apiKey: KEY });
      await expect(adapter.generate(request())).rejects.toMatchObject({
        code: 'not-configured',
      });
    }
  });

  it('maps 5xx to upstream', async () => {
    const { transport } = transportReturning({ status: 503, body: {} });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });
    await expect(adapter.generate(request())).rejects.toMatchObject({ code: 'upstream' });
  });

  it('maps a transport network failure to upstream', async () => {
    const transport: AiJsonTransport = {
      send: () => Promise.reject(new AiTransportError('network')),
    };
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });
    await expect(adapter.generate(request())).rejects.toMatchObject({ code: 'upstream' });
  });

  it('maps an aborted transport to cancelled', async () => {
    const transport: AiJsonTransport = {
      send: () => Promise.reject(new AiTransportError('aborted')),
    };
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });
    await expect(adapter.generate(request())).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('forwards the abort signal to the transport', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;

    const transport: AiJsonTransport = {
      send: async (request) => {
        seen = request.signal ?? undefined;
        return { status: 200, body: successBody };
      },
    };

    const adapter = createGeminiAdapter({ transport, apiKey: KEY });
    await adapter.generate(request({ signal: controller.signal }));
    expect(seen).toBe(controller.signal);
  });

  it('maps an unreadable body to invalid-response', async () => {
    const { transport } = transportReturning({ status: 200, body: null });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });
    await expect(adapter.generate(request())).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('maps a truncated answer to invalid-response', async () => {
    const { transport } = transportReturning({
      status: 200,
      body: { candidates: [{ content: { parts: [{ text: 'cut' }] }, finishReason: 'MAX_TOKENS' }] },
    });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });
    await expect(adapter.generate(request())).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('maps a safety block to blocked', async () => {
    const { transport } = transportReturning({
      status: 200,
      body: { candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'SAFETY' }] },
    });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });
    await expect(adapter.generate(request())).rejects.toMatchObject({ code: 'blocked' });
  });

  it('maps a prompt block to blocked', async () => {
    const { transport } = transportReturning({
      status: 200,
      body: { candidates: [], promptFeedback: { blockReason: 'SAFETY' } },
    });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });
    await expect(adapter.generate(request())).rejects.toMatchObject({ code: 'blocked' });
  });

  it('never forwards provider text in the error message', async () => {
    const { transport } = transportReturning({
      status: 400,
      body: { error: { message: 'API key not valid. Please pass a valid API key. sk-secret' } },
    });
    const adapter = createGeminiAdapter({ transport, apiKey: KEY });

    const error = await adapter.generate(request()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as Error).message).not.toMatch(/sk-secret|API key not valid/);
  });
});
