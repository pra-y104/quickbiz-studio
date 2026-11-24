/**
 * Streaming execution.
 *
 * The non-streaming pipeline (`execution.ts`) remains the reference path: it
 * validates the model's JSON before returning anything. Streaming is an
 * additional transport for interfaces that want incremental text, with the same
 * guarantees:
 *
 * - input is validated before the first token;
 * - the provider is driven with a caller signal and a hard timeout;
 * - the accumulated text is validated against the tool's output schema at the
 *   end, so a partial or malformed stream is rejected exactly like a
 *   non-streamed response;
 * - provider text is never logged.
 *
 * A provider that does not implement `stream` cannot be streamed; callers fall
 * back to `executeAiTool`.
 */

import type { AiToolOutput, AiToolRunResult, AiToolSlug } from '@quickbiz/shared';
import { getAiToolLimits, getAiToolSchemas } from '@quickbiz/shared';
import { ZodError } from 'zod';
import { getPrompt } from './prompts';
import { composeSystemPrompt, type AiGenerateRequest, type AiProvider } from './provider';
import {
  AiExecutionError,
  AiInputError,
  DEFAULT_AI_TIMEOUT_MS,
  MAX_AI_TIMEOUT_MS,
  toExecutionError,
} from './execution';

/** One streamed event. `done` carries the same metadata as a non-streamed run. */
export type AiStreamEvent<S extends AiToolSlug> =
  | { readonly type: 'delta'; readonly text: string }
  | { readonly type: 'done'; readonly result: AiToolRunResult<AiToolOutput<S>> };

export interface ExecuteAiToolStreamOptions<S extends AiToolSlug> {
  readonly tool: S;
  readonly input: unknown;
  readonly provider: AiProvider;
  readonly model?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

function assertTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) return DEFAULT_AI_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_AI_TIMEOUT_MS) {
    throw new RangeError(`timeoutMs must be between 1 and ${MAX_AI_TIMEOUT_MS}`);
  }
  return Math.floor(timeoutMs);
}

/**
 * Stream one tool run.
 *
 * Yields `delta` events as text arrives and a final `done` event whose result is
 * validated against the tool's output schema. Throws `AiInputError` before the
 * first token for bad input and `AiExecutionError` for provider or contract
 * failures.
 */
export async function* executeAiToolStream<S extends AiToolSlug>(
  options: ExecuteAiToolStreamOptions<S>,
): AsyncGenerator<AiStreamEvent<S>, void, undefined> {
  const { tool, provider } = options;
  const timeoutMs = assertTimeout(options.timeoutMs);

  let input: unknown;
  try {
    input = getAiToolSchemas(tool).input.parse(options.input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AiInputError(error.issues.map((issue) => issue.path.join('.') || '(root)'));
    }
    throw error;
  }

  if (!provider.isConfigured()) {
    throw new AiExecutionError('not-configured', 'No AI provider is configured.');
  }
  if (typeof provider.stream !== 'function') {
    throw new AiExecutionError(
      'invalid-response',
      'This provider does not support streaming; use the non-streaming endpoint.',
    );
  }

  const template = getPrompt(tool);
  const limits = getAiToolLimits(tool);
  const request: AiGenerateRequest = {
    tool,
    system: composeSystemPrompt(template),
    messages: [{ role: 'user', content: template.buildUser(input) }],
    ...(options.model === undefined ? {} : { model: options.model }),
    temperature: limits.temperature,
    maxOutputTokens: limits.maxOutputTokens,
  };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = (): void => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (options.signal?.aborted) controller.abort();

  const startedAt = Date.now();
  let text = '';
  let finishReason: 'stop' | 'length' | 'content-filter' | 'error' = 'stop';
  let model = options.model ?? provider.defaultModel;

  try {
    for await (const event of provider.stream({ ...request, signal: controller.signal })) {
      if (event.type === 'delta') {
        if (event.text.length === 0) continue;
        text += event.text;
        yield { type: 'delta', text: event.text };
      } else {
        finishReason = event.response.finishReason;
        model = event.response.model;
        // Some providers stream text and also return the full text at the end;
        // prefer the accumulated stream, which is what the caller already saw.
        if (text.length === 0 && event.response.text.length > 0) {
          text = event.response.text;
        }
      }
    }
  } catch (error) {
    if (timedOut) {
      throw new AiExecutionError('timeout', 'The AI provider did not answer in time.');
    }
    if (controller.signal.aborted) {
      throw new AiExecutionError('cancelled', 'The AI request was cancelled.');
    }
    throw toExecutionError(error);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  if (finishReason === 'content-filter') {
    throw new AiExecutionError('blocked', 'The AI provider blocked this request.');
  }
  if (finishReason === 'length') {
    throw new AiExecutionError(
      'invalid-response',
      'The AI response was cut off before it finished, so it could not be validated.',
    );
  }
  if (finishReason === 'error') {
    throw new AiExecutionError('upstream', 'The AI provider reported a failure.');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new AiExecutionError('invalid-response', 'The AI response was empty.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new AiExecutionError('invalid-response', 'The AI response was not valid JSON.');
  }

  const result = getAiToolSchemas(tool).output.safeParse(parsed);
  if (!result.success) {
    throw new AiExecutionError(
      'invalid-response',
      'The AI response did not match the tool contract.',
      { issues: result.error.issues.map((issue) => issue.path.join('.') || '(root)') },
    );
  }

  yield {
    type: 'done',
    result: {
      output: result.data as AiToolOutput<S>,
      metadata: {
        providerId: provider.id,
        model,
        promptVersion: template.version,
        finishReason,
        latencyMs: Date.now() - startedAt,
      },
    },
  };
}