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
  type AiProviderErrorCode,
  type AiToolOutput,
  type AiToolRunResult,
  type AiToolSlug,
} from '@quickbiz/shared';
import { ZodError } from 'zod';
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
 * Fixed, caller-safe text per provider error code.
 *
 * Adapter messages are for server logs only; nothing a provider returns or an
 * adapter interpolates is ever forwarded to a caller.
 */
const SAFE_PROVIDER_MESSAGES: Readonly<Record<AiProviderErrorCode, string>> = {
  'not-configured': 'No AI provider is configured.',
  timeout: 'The AI provider did not answer in time.',
  cancelled: 'The AI request was cancelled.',
  'rate-limited': 'The AI provider asked us to slow down. Try again shortly.',
  blocked: 'The AI provider blocked this request.',
  'invalid-response': 'The AI provider returned a response that could not be used.',
  upstream: 'The AI provider failed.',
};

/**
 * The caller's input did not satisfy the tool's input schema.
 *
 * Field paths are safe to return; the submitted values are not repeated.
 */
export class AiInputError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super('The AI request did not match the tool contract.');
    this.name = 'AiInputError';
    this.issues = issues;
  }
}

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
  /**
   * Extra attempts after the first for retryable provider failures. Defaults to
   * `DEFAULT_AI_RETRIES`. Retries never happen for blocked, invalid-response,
   * not-configured or cancelled runs, and never after the caller aborts.
   */
  readonly retries?: number;
  /** Base delay for exponential backoff. Defaults to `DEFAULT_AI_RETRY_BASE_MS`. */
  readonly retryBaseMs?: number;
}

/** Retry budget. Two extra attempts covers a single transient blip. */
export const DEFAULT_AI_RETRIES = 2;
export const DEFAULT_AI_RETRY_BASE_MS = 250;
const MAX_RETRY_BASE_MS = 5_000;

/** Only these failures are worth retrying; everything else is terminal.
 *
 * `rate-limited` is deliberately retried by the *caller* honoring
 * `retryAfterSeconds`, not by the pipeline: the pause belongs to the caller,
 * and retrying inside the budget would obscure the retry hint.
 */
const RETRYABLE_CODES: ReadonlySet<AiProviderErrorCode> = new Set<AiProviderErrorCode>([
  'upstream',
  'timeout',
]);

function assertRetries(retries: number | undefined): number {
  if (retries === undefined) return DEFAULT_AI_RETRIES;
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
    throw new RangeError('retries must be an integer between 0 and 5');
  }
  return retries;
}

function assertRetryBase(retryBaseMs: number | undefined): number {
  if (retryBaseMs === undefined) return DEFAULT_AI_RETRY_BASE_MS;
  if (!Number.isFinite(retryBaseMs) || retryBaseMs < 0 || retryBaseMs > MAX_RETRY_BASE_MS) {
    throw new RangeError(`retryBaseMs must be between 0 and ${MAX_RETRY_BASE_MS}`);
  }
  return Math.floor(retryBaseMs);
}

/** Promise that rejects on abort, resolves after `ms`. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiExecutionError('cancelled', 'The AI request was cancelled.'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new AiExecutionError('cancelled', 'The AI request was cancelled.'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Translate any adapter failure into the shared vocabulary with safe text. */
export function toExecutionError(error: unknown): AiExecutionError {
  if (error instanceof AiExecutionError) return error;
  if (isAiProviderError(error)) {
    return new AiExecutionError(error.code, SAFE_PROVIDER_MESSAGES[error.code], {
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
    });
  }
  return new AiExecutionError('upstream', SAFE_PROVIDER_MESSAGES.upstream);
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
export async function withBudget<T>(
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

  // 2. Versioned prompt from the registry; templates are not modified here.
  const template = getPrompt(tool);
  const limits = getAiToolLimits(tool);
  const system = composeSystemPrompt(template);
  const user = template.buildUser(input);

  const startedAt = Date.now();

  // 3. Provider call with one shared budget, plus bounded retries for transient
  //    failures. A retry reuses the same budget window per attempt.
  let response: AiGenerateResponse;
  const retries = assertRetries(options.retries);
  const retryBaseMs = assertRetryBase(options.retryBaseMs);

  try {
    response = await withBudget(
      async (signal) => {
        let lastError: AiExecutionError | undefined;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          if (signal.aborted) {
            throw new AiExecutionError('cancelled', 'The AI request was cancelled.');
          }
          try {
            return await provider.generate({
              tool,
              system,
              messages: [{ role: 'user', content: user }],
              ...(options.model === undefined ? {} : { model: options.model }),
              temperature: limits.temperature,
              maxOutputTokens: limits.maxOutputTokens,
              signal,
            });
          } catch (error) {
            const mapped = toExecutionError(error);
            lastError = mapped;
            const retryable =
              isAiProviderError(error) && RETRYABLE_CODES.has(error.code) && attempt < retries;
            if (!retryable) throw mapped;

            const retryAfter = isAiProviderError(error) ? error.retryAfterSeconds : undefined;
            const backoff =
              retryAfter !== undefined ? retryAfter * 1000 : retryBaseMs * 2 ** attempt;
            await sleep(backoff, signal);
          }
        }
        throw lastError ?? new AiExecutionError('upstream', SAFE_PROVIDER_MESSAGES.upstream);
      },
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

/** Reasons for which trying a different configured provider is worthwhile. */
const FAILOVER_REASONS: ReadonlySet<AiErrorReason> = new Set(['upstream', 'timeout']);

export interface ExecuteAiToolWithFailoverOptions<S extends AiToolSlug> {
  readonly tool: S;
  readonly input: unknown;
  /** Providers tried in registration order. */
  readonly providers: readonly AiProvider[];
  readonly model?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly retryBaseMs?: number;
}

/**
 * Run one tool across configured providers in order.
 *
 * A transient provider failure (`upstream`, `timeout`) moves to the next
 * provider; validation, blocked, rate-limited, cancelled and
 * not-configured failures propagate immediately. Quota and idempotency belong
 * to the caller, so this runs once per request regardless of how many
 * providers are attempted.
 */
export async function executeAiToolWithFailover<S extends AiToolSlug>(
  options: ExecuteAiToolWithFailoverOptions<S>,
): Promise<AiToolRunResult<AiToolOutput<S>>> {
  const { tool, providers } = options;
  if (providers.length === 0) {
    throw new AiExecutionError('not-configured', 'No AI provider is configured.');
  }

  let lastError: AiExecutionError | undefined;
  for (const provider of providers) {
    try {
      return await executeAiTool({
        tool,
        input: options.input,
        provider,
        ...(options.model === undefined ? {} : { model: options.model }),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
        ...(options.retries === undefined ? {} : { retries: options.retries }),
        ...(options.retryBaseMs === undefined ? {} : { retryBaseMs: options.retryBaseMs }),
      });
    } catch (error) {
      // Validation failures are terminal and must stay validation errors, so the
      // caller (route) can answer 422 instead of a generic provider failure.
      if (error instanceof AiInputError) throw error;
      lastError = toExecutionError(error);
      const failure = describeAiFailure(lastError);
      const canFailover =
        failure !== null &&
        failure.kind === 'provider' &&
        failure.reason !== undefined &&
        FAILOVER_REASONS.has(failure.reason) &&
        provider !== providers[providers.length - 1];
      if (!canFailover) throw lastError;
    }
  }
  throw lastError ?? new AiExecutionError('upstream', SAFE_PROVIDER_MESSAGES.upstream);
}

/** How a future route should classify a pipeline failure. */
export type AiFailureKind = 'validation' | 'unavailable' | 'provider';

export interface AiFailureDescription {
  readonly kind: AiFailureKind;
  /** Present for provider failures. */
  readonly reason?: AiErrorReason;
  /** Field paths only, for validation failures. */
  readonly issues?: readonly string[];
  readonly retryAfterSeconds?: number;
}

/**
 * Map a pipeline failure to a transport-level decision.
 *
 * Returns `null` for anything unrecognised — including the `RangeError` from an
 * invalid timeout, which is a programming error. A route must treat `null` as an
 * internal error and return a generic 500, never the original message or stack.
 *
 * Suggested HTTP mapping: `validation` → 422, `unavailable` → 503,
 * `provider` → 502 (or 429 when `reason` is `rate-limited`).
 */
export function describeAiFailure(error: unknown): AiFailureDescription | null {
  if (error instanceof AiInputError) {
    return { kind: 'validation', issues: error.issues };
  }
  if (error instanceof AiExecutionError) {
    return {
      kind: error.reason === 'not-configured' ? 'unavailable' : 'provider',
      reason: error.reason,
      ...(error.issues === undefined ? {} : { issues: error.issues }),
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
    };
  }
  // Defensive: the pipeline converts ZodError already, but a future caller may
  // pass one straight through and it must not leak schema internals.
  if (error instanceof ZodError) {
    return {
      kind: 'validation',
      issues: error.issues.map((issue) => issue.path.join('.') || '(root)'),
    };
  }
  return null;
}
