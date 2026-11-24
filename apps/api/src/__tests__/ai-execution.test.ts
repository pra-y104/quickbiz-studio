import { describe, expect, it, vi } from 'vitest';
import { AI_TOOL_LIMITS, type AiErrorReason } from '@quickbiz/shared';
import {
  AiExecutionError,
  AiInputError,
  DEFAULT_AI_TIMEOUT_MS,
  describeAiFailure,
  executeAiTool,
  executeAiToolWithFailover,
} from '../ai/execution';
import { AiProviderError } from '../ai/provider';
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

    const error = await executeAiTool({
      tool: 'ai-writer',
      input: { topic: 'too short' },
      provider,
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(AiInputError);
    expect((error as AiInputError).issues).toContain('topic');
    expect((error as Error).message).not.toContain('too short');
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

  it('never forwards adapter message text, even for a typed provider error', async () => {
    const provider: FakeProvider = new FakeProvider({ text: JSON.stringify(writerOutput) });
    provider.generate = () =>
      Promise.reject(
        new AiProviderError(
          'upstream',
          'request failed: Authorization sk-live-secret-12345 body={"prompt":"private"}',
        ),
      );

    const error = await executeAiTool({ tool: 'ai-writer', input: writerInput, provider }).catch(
      (value: unknown) => value,
    );

    expect(error).toBeInstanceOf(AiExecutionError);
    expect(error).toMatchObject({ reason: 'upstream', message: 'The AI provider failed.' });
    expect((error as Error).message).not.toMatch(/sk-live-secret|Authorization|prompt/);
  });

  it('keeps retry hints but not provider wording', async () => {
    const provider: FakeProvider = new FakeProvider({ text: JSON.stringify(writerOutput) });
    provider.generate = () =>
      Promise.reject(
        new AiProviderError('rate-limited', 'quota for project 42 exhausted', {
          retryAfterSeconds: 30,
        }),
      );

    const error = await executeAiTool({ tool: 'ai-writer', input: writerInput, provider }).catch(
      (value: unknown) => value,
    );

    expect(error).toMatchObject({ reason: 'rate-limited', retryAfterSeconds: 30 });
    expect((error as Error).message).not.toContain('project 42');
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

describe('describeAiFailure', () => {
  it('classifies input failures as validation with safe paths', async () => {
    const error = await executeAiTool({
      tool: 'ai-writer',
      input: { topic: 'too short' },
      provider: new FakeProvider(),
    }).catch((value: unknown) => value);

    const description = describeAiFailure(error);
    expect(description).toMatchObject({ kind: 'validation' });
    expect(description?.issues).toEqual(
      expect.arrayContaining(['documentType', 'topic', 'tone', 'length', 'language']),
    );
  });

  it('classifies an unconfigured provider as unavailable', () => {
    const description = describeAiFailure(
      new AiExecutionError('not-configured', 'No AI provider is configured.'),
    );
    expect(description).toEqual({ kind: 'unavailable', reason: 'not-configured' });
  });

  it('classifies provider failures with their reason and retry hint', () => {
    const description = describeAiFailure(
      new AiExecutionError('rate-limited', 'Slow down.', { retryAfterSeconds: 20 }),
    );
    expect(description).toEqual({
      kind: 'provider',
      reason: 'rate-limited',
      retryAfterSeconds: 20,
    });
  });

  it('keeps output issue paths for invalid responses', () => {
    const description = describeAiFailure(
      new AiExecutionError('invalid-response', 'Bad shape.', { issues: ['sections.0.body'] }),
    );
    expect(description).toMatchObject({
      kind: 'provider',
      reason: 'invalid-response',
      issues: ['sections.0.body'],
    });
  });

  it('returns null for programmer errors so a route can answer with a generic 500', () => {
    expect(describeAiFailure(new RangeError('timeoutMs must be between 1 and 120000'))).toBeNull();
    expect(describeAiFailure(new Error('database password rotation failed'))).toBeNull();
    expect(describeAiFailure('string failure')).toBeNull();
  });
});

describe('executeAiToolWithFailover', () => {
  const failing = () =>
    new FakeProvider({ failWith: 'upstream', text: JSON.stringify(writerOutput) });
  const succeeding = (model = 'backup-1') =>
    new FakeProvider({ defaultModel: model, text: JSON.stringify(writerOutput) });

  it('tries the next provider when the first fails with a transient reason', async () => {
    const first = failing();
    const second = succeeding();

    const result = await executeAiToolWithFailover({
      tool: 'ai-writer',
      input: writerInput,
      providers: [first, second],
      retries: 0,
    });

    expect(result.output).toEqual(writerOutput);
    expect(result.metadata.providerId).toBe('fake');
    expect(result.metadata.model).toBe('backup-1');
    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
  });

  it('does not fail over on a rate-limited failure and surfaces the retry hint', async () => {
    const first = new FakeProvider({
      failWith: 'rate-limited',
      text: JSON.stringify(writerOutput),
    });

    const error = await executeAiToolWithFailover({
      tool: 'ai-writer',
      input: writerInput,
      providers: [first, succeeding()],
      retries: 0,
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(AiExecutionError);
    expect(error).toMatchObject({ reason: 'rate-limited' });
    expect(first.calls).toHaveLength(1);
  });

  it('propagates the last error when every provider fails transiently', async () => {
    const first = failing();
    const second = failing();

    const error = await executeAiToolWithFailover({
      tool: 'ai-writer',
      input: writerInput,
      providers: [first, second],
      retries: 0,
    }).catch((value: unknown) => value);

    expect(error).toMatchObject({ reason: 'upstream' });
    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
  });

  it('does not fail over on a validation failure and never calls a provider', async () => {
    const first = failing();
    const second = succeeding();

    const error = await executeAiToolWithFailover({
      tool: 'ai-writer',
      input: { topic: 'too short' },
      providers: [first, second],
      retries: 0,
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(AiInputError);
    expect(first.calls).toHaveLength(0);
    expect(second.calls).toHaveLength(0);
  });

  it('throws not-configured when no providers are supplied', async () => {
    await expect(
      executeAiToolWithFailover({ tool: 'ai-writer', input: writerInput, providers: [] }),
    ).rejects.toMatchObject({ reason: 'not-configured' });
  });
});
