/**
 * Stable AI error vocabulary shared by the API, the UI and the tests.
 *
 * The API maps every failure to one of these reasons inside `details.reason`
 * rather than inventing new public error codes. Keeping the list closed means a
 * client can switch on it safely and a test can prove every path is covered.
 *
 * Nothing here executes a provider call. Stage 6 M0 declares the vocabulary
 * only; M1A adds the provider-error subset used by the execution pipeline.
 */

export const AI_ERROR_REASONS = [
  /** No adapter is compiled in, or no provider secret is present. */
  'not-configured',
  /** The provider did not answer inside the per-run budget. */
  'timeout',
  /** The caller aborted the request (navigation, new submission, shutdown). */
  'cancelled',
  /** The provider refused the request because of its own rate limit. */
  'rate-limited',
  /** A safety filter blocked the prompt or the response. */
  'blocked',
  /** The response was not the JSON shape the tool contract requires. */
  'invalid-response',
  /** Any other provider-side failure (5xx, connection reset, malformed body). */
  'upstream',
  /** The caller has no runs left in the current allowance. */
  'quota',
] as const;

export type AiErrorReason = (typeof AI_ERROR_REASONS)[number];

/**
 * The subset that a provider adapter may raise.
 *
 * `quota` is deliberately excluded: an allowance is a wallet decision made by
 * the platform, never by a provider adapter. Stage 7 owns it.
 */
export const AI_PROVIDER_ERROR_CODES = [
  'not-configured',
  'timeout',
  'cancelled',
  'rate-limited',
  'blocked',
  'invalid-response',
  'upstream',
] as const;

export type AiProviderErrorCode = (typeof AI_PROVIDER_ERROR_CODES)[number];

/** Lifecycle value stored for every run once persistence exists (M2). */
export const AI_RUN_STATUSES = ['succeeded', 'failed', 'blocked', 'cancelled'] as const;

export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

/**
 * Why `/api/v1/ai/status` reports the feature as unavailable.
 *
 * - `no-adapters-registered`: no adapter exists in this build (M0 state).
 * - `provider-not-configured`: an adapter exists but no key is present.
 * - `ready`: at least one adapter is registered and configured.
 */
export const AI_AVAILABILITY_REASONS = [
  'no-adapters-registered',
  'provider-not-configured',
  'ready',
] as const;

export type AiAvailabilityReason = (typeof AI_AVAILABILITY_REASONS)[number];

export function isAiErrorReason(value: unknown): value is AiErrorReason {
  return typeof value === 'string' && (AI_ERROR_REASONS as readonly string[]).includes(value);
}

export function isAiProviderErrorCode(value: unknown): value is AiProviderErrorCode {
  return (
    typeof value === 'string' && (AI_PROVIDER_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function isAiRunStatus(value: unknown): value is AiRunStatus {
  return typeof value === 'string' && (AI_RUN_STATUSES as readonly string[]).includes(value);
}
