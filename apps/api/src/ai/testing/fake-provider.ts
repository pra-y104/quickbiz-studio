/**
 * Deterministic fake provider for offline tests.
 *
 * This file is under `ai/testing/` and is imported only by tests. No route,
 * middleware or app module references it, so it is not reachable from a
 * production bundle. It makes no network request, reads no environment
 * variable and is never registered in `productionRegistry`.
 *
 * Its output is fixed by the test that constructs it; it never invents a
 * plausible-looking business answer on its own.
 */

import type { AiFinishReason, AiProviderErrorCode, AiUsage } from '@quickbiz/shared';
import {
  AiProviderError,
  type AiGenerateRequest,
  type AiGenerateResponse,
  type AiProvider,
  type AiProviderStreamEvent,
} from '../provider';

export interface FakeProviderOptions {
  readonly id?: string;
  readonly label?: string;
  readonly defaultModel?: string;
  /** False simulates an adapter with no usable credential. */
  readonly configured?: boolean;
  /** Fixed text, or a function of the request, so tests can echo input. */
  readonly text?: string | ((request: AiGenerateRequest) => string);
  readonly finishReason?: AiFinishReason;
  readonly usage?: AiUsage;
  /** Throw this shared provider error instead of returning text. */
  readonly failWith?: AiProviderErrorCode;
  /** Simulated latency in milliseconds; the pipeline's timeout still applies. */
  readonly delayMs?: number;
  /**
   * Ignore the abort signal during `delayMs`. Used to prove that the pipeline
   * timeout does not depend on adapter cooperation.
   */
  readonly ignoreSignal?: boolean;
  /**
   * Split the text into these deltas when streaming. Defaults to a single delta
   * containing the whole text, so streaming and non-streaming agree.
   */
  readonly streamChunks?: readonly string[];
}

function sleep(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    function onAbort(): void {
      clearTimeout(timer);
      reject(new AiProviderError('cancelled', 'The AI request was cancelled.'));
    }

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class FakeProvider implements AiProvider {
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  /** Every request the pipeline passed in, in order. */
  readonly calls: AiGenerateRequest[] = [];

  readonly #options: FakeProviderOptions;

  constructor(options: FakeProviderOptions = {}) {
    this.#options = options;
    this.id = options.id ?? 'fake';
    this.label = options.label ?? 'Fake provider';
    this.defaultModel = options.defaultModel ?? 'fake-model';
  }

  isConfigured(): boolean {
    return this.#options.configured ?? true;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    this.calls.push(request);

    if (!this.isConfigured()) {
      throw new AiProviderError('not-configured', 'No AI provider is configured.');
    }

    const { failWith } = this.#options;
    if (failWith !== undefined) {
      throw new AiProviderError(failWith, `Fake provider failure: ${failWith}.`);
    }

    const delayMs = this.#options.delayMs ?? 0;
    if (delayMs > 0) {
      await sleep(delayMs, this.#options.ignoreSignal === true ? undefined : request.signal);
    }

    if (request.signal?.aborted) {
      throw new AiProviderError('cancelled', 'The AI request was cancelled.');
    }

    const text =
      typeof this.#options.text === 'function'
        ? this.#options.text(request)
        : (this.#options.text ?? '{}');

    return {
      text,
      providerId: this.id,
      model: request.model ?? this.defaultModel,
      finishReason: this.#options.finishReason ?? 'stop',
      ...(this.#options.usage === undefined ? {} : { usage: this.#options.usage }),
    };
  }

  async *stream(request: AiGenerateRequest): AsyncIterable<AiProviderStreamEvent> {
    if (!this.isConfigured()) {
      throw new AiProviderError('not-configured', 'No AI provider is configured.');
    }

    const { failWith } = this.#options;
    if (failWith !== undefined) {
      throw new AiProviderError(failWith, `Fake provider failure: ${failWith}.`);
    }

    const text =
      typeof this.#options.text === 'function'
        ? this.#options.text(request)
        : (this.#options.text ?? '{}');

    const chunks = this.#options.streamChunks ?? [text];
    for (const chunk of chunks) {
      if (request.signal?.aborted) {
        throw new AiProviderError('cancelled', 'The AI request was cancelled.');
      }
      yield { type: 'delta', text: chunk };
    }

    yield {
      type: 'done',
      response: {
        text,
        providerId: this.id,
        model: request.model ?? this.defaultModel,
        finishReason: this.#options.finishReason ?? 'stop',
        ...(this.#options.usage === undefined ? {} : { usage: this.#options.usage }),
      },
    };
  }
}
