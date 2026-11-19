/**
 * Prompt registry.
 *
 * Slugs are keyed by the shared `AI_TOOL_SLUGS` tuple so the record cannot be
 * missing an entry without a type error. A test also asserts that every version
 * matches `AI_PROMPT_VERSIONS`, so the prompt that ran is the version recorded
 * on the run.
 */

import type { AiToolSlug } from '@quickbiz/shared';
import { advertPrompt } from './advert';
import { businessNamePrompt } from './business-name';
import { businessPlanPrompt } from './business-plan';
import { productDescriptionPrompt } from './product-description';
import { socialCaptionPrompt } from './social-caption';
import { textImproverPrompt } from './text-improver';
import { translatorPrompt } from './translator';
import type { PromptTemplate } from './types';
import { writerPrompt } from './writer';

export const AI_PROMPTS: Readonly<Record<AiToolSlug, PromptTemplate>> = {
  'ai-writer': writerPrompt,
  'ad-generator': advertPrompt,
  translator: translatorPrompt,
  'text-improver': textImproverPrompt,
  'product-description': productDescriptionPrompt,
  'business-name-generator': businessNamePrompt,
  'social-caption': socialCaptionPrompt,
  'business-plan-assistant': businessPlanPrompt,
};

export function getPrompt(slug: AiToolSlug): PromptTemplate {
  return AI_PROMPTS[slug];
}

export function hasPrompt(slug: string): slug is AiToolSlug {
  return Object.prototype.hasOwnProperty.call(AI_PROMPTS, slug);
}

export type { PromptTemplate };
