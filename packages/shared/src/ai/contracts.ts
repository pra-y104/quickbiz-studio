/**
 * Registry that ties each AI tool slug to its schema, limits and prompt version.
 *
 * The catalogue in `catalog/tools.ts` stays the source of truth for whether a
 * tool exists and whether it is chargeable. This module answers the narrower
 * question a request handler needs: what does this tool accept, what must it
 * return, and how much output may it ask for.
 *
 * The slug list is duplicated here on purpose so it can be typed, and a test
 * asserts it matches the catalogue exactly. A mismatch fails the build rather
 * than silently exposing a tool with no contract.
 */

import {
  aiAdvertInputSchema,
  aiAdvertOutputSchema,
  aiBusinessNameInputSchema,
  aiBusinessNameOutputSchema,
  aiBusinessPlanInputSchema,
  aiBusinessPlanOutputSchema,
  aiProductDescriptionInputSchema,
  aiProductDescriptionOutputSchema,
  aiSocialCaptionInputSchema,
  aiSocialCaptionOutputSchema,
  aiTextImproverInputSchema,
  aiTextImproverOutputSchema,
  aiTranslatorInputSchema,
  aiTranslatorOutputSchema,
  aiWriterInputSchema,
  aiWriterOutputSchema,
  type AiAdvertOutput,
  type AiBusinessNameOutput,
  type AiBusinessPlanOutput,
  type AiProductDescriptionOutput,
  type AiSocialCaptionOutput,
  type AiTextImproverOutput,
  type AiTranslatorOutput,
  type AiWriterOutput,
} from './schemas';
import type { AiAvailabilityReason } from './errors';
import type { ToolStatus } from '../types/tool';

export const AI_TOOL_SLUGS = [
  'ai-writer',
  'ad-generator',
  'translator',
  'text-improver',
  'product-description',
  'business-name-generator',
  'social-caption',
  'business-plan-assistant',
] as const;

export type AiToolSlug = (typeof AI_TOOL_SLUGS)[number];

export function isAiToolSlug(value: unknown): value is AiToolSlug {
  return typeof value === 'string' && (AI_TOOL_SLUGS as readonly string[]).includes(value);
}

/**
 * Prompt versions are owned here so the API prompts cannot drift from the
 * version recorded on a run. Bump a version whenever the wording changes.
 */
export const AI_PROMPT_VERSIONS: Readonly<Record<AiToolSlug, string>> = {
  'ai-writer': 'writer-v1',
  'ad-generator': 'advert-v1',
  translator: 'translator-v1',
  'text-improver': 'improver-v1',
  'product-description': 'product-description-v1',
  'business-name-generator': 'business-name-v1',
  'social-caption': 'social-caption-v1',
  'business-plan-assistant': 'business-plan-v1',
};

export interface AiToolLimits {
  readonly slug: AiToolSlug;
  /**
   * Upper bound for the serialised input, checked before any provider call.
   * Provisional: the final per-tool values need owner approval (decision D15).
   */
  readonly maxInputChars: number;
  /** Output token ceiling, so worst-case cost per run is bounded. */
  readonly maxOutputTokens: number;
  readonly temperature: number;
}

export const AI_TOOL_LIMITS: Readonly<Record<AiToolSlug, AiToolLimits>> = {
  'ai-writer': {
    slug: 'ai-writer',
    maxInputChars: 8_000,
    maxOutputTokens: 1_200,
    temperature: 0.6,
  },
  'ad-generator': {
    slug: 'ad-generator',
    maxInputChars: 4_000,
    maxOutputTokens: 900,
    temperature: 0.7,
  },
  translator: {
    slug: 'translator',
    maxInputChars: 6_000,
    maxOutputTokens: 1_500,
    temperature: 0.3,
  },
  'text-improver': {
    slug: 'text-improver',
    maxInputChars: 8_000,
    maxOutputTokens: 1_500,
    temperature: 0.4,
  },
  'product-description': {
    slug: 'product-description',
    maxInputChars: 4_000,
    maxOutputTokens: 900,
    temperature: 0.6,
  },
  'business-name-generator': {
    slug: 'business-name-generator',
    maxInputChars: 2_000,
    maxOutputTokens: 800,
    temperature: 0.8,
  },
  'social-caption': {
    slug: 'social-caption',
    maxInputChars: 3_000,
    maxOutputTokens: 700,
    temperature: 0.7,
  },
  'business-plan-assistant': {
    slug: 'business-plan-assistant',
    maxInputChars: 2_000,
    maxOutputTokens: 2_500,
    temperature: 0.5,
  },
};

interface ParsableSchema {
  parse(value: unknown): unknown;
}

/**
 * Input and output schemas per tool. Both are exposed so the API can validate
 * the request and then the provider's JSON with the same definition the UI uses.
 */
export const AI_TOOL_SCHEMAS = {
  'ai-writer': { input: aiWriterInputSchema, output: aiWriterOutputSchema },
  'ad-generator': { input: aiAdvertInputSchema, output: aiAdvertOutputSchema },
  translator: { input: aiTranslatorInputSchema, output: aiTranslatorOutputSchema },
  'text-improver': { input: aiTextImproverInputSchema, output: aiTextImproverOutputSchema },
  'product-description': {
    input: aiProductDescriptionInputSchema,
    output: aiProductDescriptionOutputSchema,
  },
  'business-name-generator': {
    input: aiBusinessNameInputSchema,
    output: aiBusinessNameOutputSchema,
  },
  'social-caption': { input: aiSocialCaptionInputSchema, output: aiSocialCaptionOutputSchema },
  'business-plan-assistant': {
    input: aiBusinessPlanInputSchema,
    output: aiBusinessPlanOutputSchema,
  },
} as const satisfies Record<AiToolSlug, { input: ParsableSchema; output: ParsableSchema }>;

export function getAiToolLimits(slug: AiToolSlug): AiToolLimits {
  return AI_TOOL_LIMITS[slug];
}

export function getAiToolSchemas(slug: AiToolSlug) {
  return AI_TOOL_SCHEMAS[slug];
}

/**
 * Typed output for each tool slug.
 *
 * This is the type-level counterpart of `AI_TOOL_SCHEMAS` so the execution
 * pipeline can return a concrete type per tool instead of `unknown`.
 */
export interface AiToolOutputBySlug {
  readonly 'ai-writer': AiWriterOutput;
  readonly 'ad-generator': AiAdvertOutput;
  readonly translator: AiTranslatorOutput;
  readonly 'text-improver': AiTextImproverOutput;
  readonly 'product-description': AiProductDescriptionOutput;
  readonly 'business-name-generator': AiBusinessNameOutput;
  readonly 'social-caption': AiSocialCaptionOutput;
  readonly 'business-plan-assistant': AiBusinessPlanOutput;
}

export type AiToolOutput<S extends AiToolSlug> = AiToolOutputBySlug[S];

/* -------------------------------------------------------------------------- */
/* Availability contract                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One tool as reported by `GET /api/v1/ai/status`.
 *
 * `status` and `creditCost` mirror the catalogue so the client has a single
 * source for whether a tool can run and whether it is chargeable. In M0 both
 * stay `planned` / `null` for every AI tool.
 */
export interface AiToolStatus {
  readonly slug: AiToolSlug;
  readonly status: ToolStatus;
  readonly creditCost: number | null;
  readonly promptVersion: string;
}

/**
 * Response body for `GET /api/v1/ai/status`.
 *
 * `configured` is true only when an adapter is compiled in *and* configured.
 * `quota` is permanently `null` until server-side enforcement exists; a client
 * must never read it as an unlimited allowance.
 */
export interface AiStatus {
  readonly configured: boolean;
  readonly reason: AiAvailabilityReason;
  readonly requestedProvider: string | null;
  readonly model: string | null;
  readonly quota: null;
  readonly tools: readonly AiToolStatus[];
  readonly total: number;
}
