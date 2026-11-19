/**
 * Shared AI execution pipeline.
 *
 * One code path runs every tool: validate input, build the versioned prompt,
 * call a provider with a hard timeout and cancellation, then validate the
 * provider's JSON against the tool's output schema. Nothing reaches a caller
 * unless it satisfies the contract.
 *
 * The pipeline is transport-agnostic and is not wired to an HTTP route in M1A:
 * `POST /api/v1/ai/run` stays unimplemented until a reviewed adapter exists.
 */

import {
  getAiToolLimits,
  getAiToolSchemas,
  type AiErrorReason,
  type AiFinishReason,
  type AiToolOutput,
  type AiToolRunResult,
  type AiToolSlug,
} from '@quickbiz/shared';
import { getPrompt } from './prompts';
import {
  composeSystemPrompt,
  isAiProviderError,
  type AiGenerateResponse,
  type AiProvider,
} from './provider';

/** Per-run budget when a caller does not supply one. Provisional (decision D15). */
export const DEFAULT_AI_TIMEOUT_MS = 20_000;
/** Hard ceiling for a caller-supplied budget, so no request can hang forever. */
export const MAX_AI_TIMEOUT_MS = 120_000;

/**
 * A failure the caller can act on.
 *
 * `reason` is the shared, provider-independent vocabulary. Adapter failures are
 * translated into it here so the interface and future routes never see a
 * vendor-specific code.
 */
export class AiExecutionError extends Error {
  readonly reason: AiErrorReason;
  /** Field paths only; never the model's text or the user's input. */
  readonly issues?: readonly string[];
  readonly retryAfterSeconds?: number;

  constructor(
    reason: AiErrorReason,
    message: string,
    options: { readonly issues?: readonly string[]; readonly retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'AiExecutionError';
    this.reason = reason;
    if (options.issues !== undefined) this.issues = options.issues;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export interface ExecuteAiToolOptions<S extends AiToolSlug> {
  readonly tool: S;
  /** Raw input; parsed with the tool's input schema before anything else. */
  readonly input: unknown;
  readonly provider: AiProvider;
  /** Overrides the adapter default when set. */
  readonly model?: string;
  /** Caller cancellation: navigation, a new submission, shutdown. */
  readonly signal?: AbortSignal;
  /** Per-run budget. Defaults to `DEFAULT_AI_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
}

/** Translate any adapter failure into the shared vocabulary. */
function toExecutionError(error: unknown): AiExecutionError {
  if (error instanceof AiExecutionError) return error;
  if (isAiProviderError(error)) {
    return new AiExecutionError(error.code, error.message, {
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
    });
  }
  return new AiExecutionError('upstream', 'The AI provider failed.');
}

function assertTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) return DEFAULT_AI_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_AI_TIMEOUT_MS) {
    throw new RangeError(`timeoutMs must be between 1 and ${MAX_AI_TIMEOUT_MS}`);
  }
  return Math.floor(timeoutMs);
}

/**
 * Run `task` with a single signal that aborts on caller cancellation or
 * timeout.
 *
 * The race is deliberate: an adapter that ignores the signal still cannot make
 * the request hang, because the abort promise settles the pipeline anyway.
 */
async function withBudget<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
  timeoutMessage: string,
  cancelledMessage: string,
): Promise<T> {
  const controller = new AbortController();
  let abortReason: 'timeout' | 'cancelled' | null = null;
  let rejectAbort: ((error: AiExecutionError) => void) | undefined;

  const onAbort = () => {
    rejectAbort?.(
      new AiExecutionError(
        abortReason === 'timeout' ? 'timeout' : 'cancelled',
        abortReason === 'timeout' ? timeoutMessage : cancelledMessage,
      ),
    );
  };

  const abortFromCaller = () => {
    if (controller.signal.aborted) return;
    abortReason = 'cancelled';
    controller.abort();
  };

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  controller.signal.addEventListener('abort', onAbort, { once: true });

  // A signal can already be aborted before the listener is attached.
  if (controller.signal.aborted) onAbort();

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (!controller.signal.aborted) {
    timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      abortReason = 'timeout';
      controller.abort();
    }, timeoutMs);
  }

  try {
    return await Promise.race([task(controller.signal), abortPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
    controller.signal.removeEventListener('abort', onAbort);
  }
}

/** Parse JSON strictly; fences, prose or an empty body are a contract breach. */
function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new AiExecutionError('invalid-response', 'The AI response was empty.');
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new AiExecutionError('invalid-response', 'The AI response was not valid JSON.');
  }
}

function assertFinishReason(finishReason: AiFinishReason): void {
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
}

/**
 * Validate the provider text against the tool's output schema.
 *
 * Extra keys are stripped by the schema; a missing required field, wrong type
 * or out-of-range value is rejected. Only field paths are surfaced.
 */
function validateOutput<S extends AiToolSlug>(tool: S, text: string): AiToolOutput<S> {
  const parsed = parseJsonObject(text);
  const result = getAiToolSchemas(tool).output.safeParse(parsed);
  if (!result.success) {
    throw new AiExecutionError(
      'invalid-response',
      'The AI response did not match the tool contract.',
      { issues: result.error.issues.map((issue) => issue.path.join('.') || '(root)') },
    );
  }
  return result.data as AiToolOutput<S>;
}

/** Normalise the adapter response and reject anything that is not usable text. */
function assertResponse(response: AiGenerateResponse): void {
  if (typeof response.text !== 'string' || response.text.length === 0) {
    throw new AiExecutionError('invalid-response', 'The AI provider returned no text.');
  }
  if (typeof response.model !== 'string' || response.model.length === 0) {
    throw new AiExecutionError('invalid-response', 'The AI provider returned no model name.');
  }
}

export async function executeAiTool<S extends AiToolSlug>(
  options: ExecuteAiToolOptions<S>,
): Promise<AiToolRunResult<AiToolOutput<S>>> {
  const { tool, provider } = options;
  const timeoutMs = assertTimeout(options.timeoutMs);

  // 1. Input first: an invalid request never becomes a provider call.
  const input = getAiToolSchemas(tool).input.parse(options.input);

  if (!provider.isConfigured()) {
    throw new AiExecutionError('not-configured', 'No AI provider is configured.');
  }

  // 2. Versioned prompt from the registry; templates are not modified here.
  const template = getPrompt(tool);
  const limits = getAiToolLimits(tool);
  const system = composeSystemPrompt(template);
  const user = template.buildUser(input);

  const startedAt = Date.now();

  // 3. Provider call with one shared budget.
  let response: AiGenerateResponse;
  try {
    response = await withBudget(
      (signal) =>
        provider.generate({
          tool,
          system,
          messages: [{ role: 'user', content: user }],
          ...(options.model === undefined ? {} : { model: options.model }),
          temperature: limits.temperature,
          maxOutputTokens: limits.maxOutputTokens,
          signal,
        }),
      timeoutMs,
      options.signal,
      'The AI provider did not answer in time.',
      'The AI request was cancelled.',
    );
  } catch (error) {
    throw toExecutionError(error);
  }

  const latencyMs = Date.now() - startedAt;

  // 4. Contract checks before the schema, so a truncation is not misreported.
  assertResponse(response);
  assertFinishReason(response.finishReason);
  const output = validateOutput(tool, response.text);

  return {
    output,
    metadata: {
      providerId: response.providerId,
      model: response.model,
      promptVersion: template.version,
      finishReason: response.finishReason,
      ...(response.usage === undefined ? {} : { usage: response.usage }),
      latencyMs,
    },
  };
}
