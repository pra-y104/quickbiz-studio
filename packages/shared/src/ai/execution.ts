/**
 * Execution metadata shared by the API and the interface.
 *
 * These types describe a completed provider call without naming a provider.
 * They are safe to serialise: they contain identifiers and counters, never a
 * key, prompt or raw provider payload.
 */

import type { AiToolSlug } from './contracts';

/**
 * Why generation stopped.
 *
 * - `stop`: the model finished its answer.
 * - `length`: the token ceiling cut the answer short.
 * - `content-filter`: a safety filter stopped generation.
 * - `error`: the provider reported an internal failure.
 * - `unknown`: the provider gave no usable reason.
 */
export const AI_FINISH_REASONS = ['stop', 'length', 'content-filter', 'error', 'unknown'] as const;

export type AiFinishReason = (typeof AI_FINISH_REASONS)[number];

export function isAiFinishReason(value: unknown): value is AiFinishReason {
  return typeof value === 'string' && (AI_FINISH_REASONS as readonly string[]).includes(value);
}

/**
 * Token counts as reported by the provider. Every field is optional because a
 * provider may omit them; the platform never estimates a count in their place.
 */
export interface AiUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/** Non-sensitive metadata about one completed tool run. */
export interface AiRunMetadata {
  readonly providerId: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly finishReason: AiFinishReason;
  readonly usage?: AiUsage;
  readonly latencyMs: number;
}

/** Output plus metadata, validated against the tool's output schema. */
export interface AiToolRunResult<T> {
  readonly output: T;
  readonly metadata: AiRunMetadata;
}

/** Pointer to which tool a request is for. Kept separate from the request body. */
export interface AiToolIdentity {
  readonly tool: AiToolSlug;
}
