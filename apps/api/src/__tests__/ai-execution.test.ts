import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { AI_TOOL_LIMITS, type AiErrorReason } from '@quickbiz/shared';
import { AiExecutionError, DEFAULT_AI_TIMEOUT_MS, executeAiTool } from '../ai/execution';
import { FakeProvider } from '../ai/testing/fake-provider';

const writerInput = {
  documentType: 'article',
  topic: 'A practical guide to opening a small bakery in Lagos',
  tone: 'friendly',
  length: 'medium',
  language: 'en',
} as const;

const writerOutput = {
  title: 'Opening a small bakery',
  sections: [{ heading: 'Start small', body: 'Bake for one cafe before renting a shop.' }],
};

async function expectReason(promise: Promise<unknown>, reason: AiErrorReason): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AiExecutionError);
  await expect(promise).rejects.toMatchObject({ reason });
}

describe('executeAiTool: success path', () => {
  it('returns validated output and metadata from the fake provider', async () => {
    const provider = new FakeProvider({
      defaultModel: 'fake-1',
      text: JSON.stringify(writerOutput),
      usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
    });

    const result = await executeAiTool({ tool: 'ai-writer', input: writerInput, provider });

    expect(result.output).toEqual(writerOutput);
    expect(result.metadata).toMatchObject({
      providerId: 'fake',
      model: 'fake-1',
      promptVersion: 'writer-v1',
      finishReason: 'stop',
      usage: { inputTokens: 12, outputTokens: 34, totalTokens: 46 },
    });
    expect(result.metadata.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('sends the versioned template, the limits and a delimited user turn', async () => {
    const provider = new FakeProvider({ text: JSON.stringify(writerOutput) });

    await executeAiTool({
      tool: 'ai-writer',
      input: writerInput,
      provider,
      model: 'explicit-model',
    });

    expect(provider.calls).toHaveLength(1);
    const [call] = provider.calls;
    const limits = AI_TOOL_LIMITS['ai-writer'];
    expect(call?.tool).toBe('ai-writer');
    expect(call?.model).toBe('explicit-model');
    expect(call?.maxOutputTokens).toBe(limits.maxOutputTokens);
    expect(call?.temperature).toBe(limits.temperature);
    expect(call?.system).toContain('Return JSON matching this contract');
    expect(call?.messages[0]?.content.startsWith('<user_input>')).toBe(true);
  });

  it('strips unknown output keys instead of failing', async () => {
    const provider = new FakeProvider({
      text: JSON.stringify({ ...writerOutput, confidence: 0.9 }),
    });

    const result = await executeAiTool({ tool: 'ai-writer', input: writerInput, provider });
    expect(result.output).not.toHaveProperty('confidence');
  });
});

describe('executeAiTool: input handling', () => {
  it('rejects invalid input before calling the provider', async () => {
    const provider = new FakeProvider({ text: JSON.stringify(writerOutput) });

    await expect(
      executeAiTool({ tool: 'ai-writer', input: { topic: 'too short' }, provider }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(provider.calls).toHaveLength(0);
  });

  it('defaults the timeout and rejects an out-of-range override', async () => {
    const provider = new FakeProvider({ text: JSON.stringify(writerOutput) });
    await expect(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider, timeoutMs: 0 }),
    ).rejects.toBeInstanceOf(RangeError);
    expect(DEFAULT_AI_TIMEOUT_MS).toBeGreaterThan(0);
    expect(provider.calls).toHaveLength(0);
  });
});

describe('executeAiTool: output contract', () => {
  it('rejects a response that is not JSON', async () => {
    const provider = new FakeProvider({ text: 'Sure! Here is your article:' });
    await expectReason(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider }),
      'invalid-response',
    );
  });

  it('rejects JSON that does not satisfy the schema and reports paths only', async () => {
    const provider = new FakeProvider({
      text: JSON.stringify({ title: 'Missing sections', sections: [] }),
    });

    const error = await executeAiTool({ tool: 'ai-writer', input: writerInput, provider }).catch(
      (value: unknown) => value,
    );

    expect(error).toBeInstanceOf(AiExecutionError);
    expect(error).toMatchObject({ reason: 'invalid-response' });
    expect((error as AiExecutionError).issues).toContain('sections');
  });

  it('rejects an empty body', async () => {
    const provider = new FakeProvider({ text: '   ' });
    await expectReason(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider }),
      'invalid-response',
    );
  });

  it('rejects a truncated response before parsing it', async () => {
    const provider = new FakeProvider({
      text: JSON.stringify(writerOutput),
      finishReason: 'length',
    });
    await expectReason(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider }),
      'invalid-response',
    );
  });

  it('maps a safety block to blocked', async () => {
    const provider = new FakeProvider({ finishReason: 'content-filter', text: '{}' });
    await expectReason(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider }),
      'blocked',
    );
  });

  it('rejects a response with no text', async () => {
    const provider = new FakeProvider({ text: '' });
    await expectReason(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider }),
      'invalid-response',
    );
  });
});

describe('executeAiTool: provider failures', () => {
  it('fails closed when the provider has no usable credential', async () => {
    const provider = new FakeProvider({ configured: false });
    await expectReason(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider }),
      'not-configured',
    );
    expect(provider.calls).toHaveLength(0);
  });

  it('translates provider errors into the shared vocabulary', async () => {
    const provider = new FakeProvider({ failWith: 'rate-limited' });
    await expectReason(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider }),
      'rate-limited',
    );
  });

  it('hides unexpected adapter failures behind upstream', async () => {
    const provider: FakeProvider = new FakeProvider({ text: JSON.stringify(writerOutput) });
    provider.generate = () => Promise.reject(new Error('socket hang up: 10.0.0.1'));

    const error = await executeAiTool({ tool: 'ai-writer', input: writerInput, provider }).catch(
      (value: unknown) => value,
    );

    expect(error).toBeInstanceOf(AiExecutionError);
    expect(error).toMatchObject({ reason: 'upstream' });
    expect((error as Error).message).not.toContain('10.0.0.1');
  });
});

describe('executeAiTool: timeout and cancellation', () => {
  it('times out even when the adapter ignores the abort signal', async () => {
    vi.useFakeTimers();
    try {
      const provider = new FakeProvider({
        text: JSON.stringify(writerOutput),
        delayMs: 60_000,
        ignoreSignal: true,
      });

      const promise = executeAiTool({
        tool: 'ai-writer',
        input: writerInput,
        provider,
        timeoutMs: 1_000,
      });
      const assertion = expect(promise).rejects.toMatchObject({ reason: 'timeout' });

      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects immediately when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = new FakeProvider({ text: JSON.stringify(writerOutput) });

    await expectReason(
      executeAiTool({ tool: 'ai-writer', input: writerInput, provider, signal: controller.signal }),
      'cancelled',
    );
  });

  it('cancels a request in flight', async () => {
    const controller = new AbortController();
    const provider = new FakeProvider({
      text: JSON.stringify(writerOutput),
      delayMs: 5_000,
    });

    const promise = executeAiTool({
      tool: 'ai-writer',
      input: writerInput,
      provider,
      signal: controller.signal,
      timeoutMs: 10_000,
    });
    const assertion = expect(promise).rejects.toMatchObject({ reason: 'cancelled' });

    // Let generate() start, then cancel.
    await Promise.resolve();
    controller.abort();
    await assertion;
  });
});

describe('executeAiTool: cost metadata', () => {
  it('omits usage when the provider does not report it', async () => {
    const provider = new FakeProvider({ text: JSON.stringify(writerOutput) });
    const result = await executeAiTool({ tool: 'ai-writer', input: writerInput, provider });
    expect(result.metadata.usage).toBeUndefined();
  });
});
