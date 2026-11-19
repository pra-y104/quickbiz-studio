/**
 * Input and output contracts for the eight AI tools.
 *
 * These schemas are the single source of truth for what a tool accepts and what
 * it must return. The web form validates against the input schema and the API
 * validates the model's JSON against the output schema before anything reaches
 * the interface, so a provider cannot invent a new shape.
 *
 * Rules that shaped this file:
 *
 * 1. Inputs are strict: an unknown field is a bug, not something to ignore.
 * 2. Outputs are parsed leniently about extra keys (they are stripped) but
 *    strictly about required keys and types.
 * 3. Every string is trimmed and length-capped, so a huge paste is rejected
 *    before it could become a paid request.
 * 4. Nothing here calls a provider. M0 defines the contracts only.
 */

import { z } from 'zod';
import { AI_LANGUAGE_CODES, AI_SOURCE_LANGUAGE_CODES } from './languages';
import {
  AI_AD_OBJECTIVES,
  AI_AD_PLATFORMS,
  AI_DOCUMENT_TYPES,
  AI_FORMALITIES,
  AI_IMPROVER_GOALS,
  AI_LENGTH_PREFERENCES,
  AI_LENGTHS,
  AI_NAME_STYLES,
  AI_PLAN_AUDIENCES,
  AI_PLAN_SECTIONS,
  AI_PLAN_STAGES,
  AI_PRODUCT_PLATFORMS,
  AI_SOCIAL_PLATFORMS,
  AI_TONES,
} from './options';

const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, 'Use a three-letter ISO currency code');

/* -------------------------------------------------------------------------- */
/* AI Writer                                                                  */
/* -------------------------------------------------------------------------- */

export const aiWriterInputSchema = z
  .object({
    documentType: z.enum(AI_DOCUMENT_TYPES),
    topic: z
      .string()
      .trim()
      .min(20, 'Describe what the document is about in at least 20 characters')
      .max(2_000),
    audience: z.string().trim().max(200).optional(),
    tone: z.enum(AI_TONES),
    length: z.enum(AI_LENGTHS),
    language: z.enum(AI_LANGUAGE_CODES),
    keyPoints: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
    callToAction: z.string().trim().max(200).optional(),
  })
  .strict();

export type AiWriterInput = z.infer<typeof aiWriterInputSchema>;

export const aiWriterOutputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(6_000),
      }),
    )
    .min(1)
    .max(12),
});

export type AiWriterOutput = z.infer<typeof aiWriterOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Advertisement Generator                                                    */
/* -------------------------------------------------------------------------- */

export const aiAdvertInputSchema = z
  .object({
    product: z.string().trim().min(2).max(500),
    audience: z.string().trim().max(300).optional(),
    platform: z.enum(AI_AD_PLATFORMS),
    objective: z.enum(AI_AD_OBJECTIVES),
    offer: z.string().trim().max(200).optional(),
    tone: z.enum(AI_TONES),
    callToAction: z.string().trim().max(120).optional(),
    hashtagCount: z.number().int().min(0).max(10).default(0),
  })
  .strict();

export type AiAdvertInput = z.infer<typeof aiAdvertInputSchema>;

export const aiAdvertOutputSchema = z.object({
  variants: z
    .array(
      z.object({
        headline: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(900),
        cta: z.string().trim().min(1).max(80),
      }),
    )
    .length(3),
  hashtags: z.array(z.string().trim().min(1).max(40)).max(10),
});

export type AiAdvertOutput = z.infer<typeof aiAdvertOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Translator                                                                 */
/* -------------------------------------------------------------------------- */

export const aiTranslatorInputSchema = z
  .object({
    text: z.string().trim().min(1).max(6_000),
    sourceLanguage: z.enum(AI_SOURCE_LANGUAGE_CODES),
    targetLanguage: z.enum(AI_LANGUAGE_CODES),
    formality: z.enum(AI_FORMALITIES).default('neutral'),
    preserveLineBreaks: z.boolean().default(true),
  })
  .strict();

export type AiTranslatorInput = z.infer<typeof aiTranslatorInputSchema>;

export const aiTranslatorOutputSchema = z.object({
  translation: z.string().trim().min(1).max(20_000),
  detectedSourceLanguage: z.enum(AI_LANGUAGE_CODES).optional(),
  notes: z.array(z.string().trim().min(1).max(300)).max(5).optional(),
});

export type AiTranslatorOutput = z.infer<typeof aiTranslatorOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Text Improver                                                              */
/* -------------------------------------------------------------------------- */

export const aiTextImproverInputSchema = z
  .object({
    text: z.string().trim().min(1).max(8_000),
    goal: z.enum(AI_IMPROVER_GOALS),
    keepMeaning: z.boolean().default(true),
    lengthPreference: z.enum(AI_LENGTH_PREFERENCES).default('similar'),
    language: z.enum(AI_LANGUAGE_CODES).optional(),
  })
  .strict();

export type AiTextImproverInput = z.infer<typeof aiTextImproverInputSchema>;

export const aiTextImproverOutputSchema = z.object({
  improved: z.string().trim().min(1).max(12_000),
  changes: z.array(z.string().trim().min(1).max(300)).max(10),
  summary: z.string().trim().min(1).max(400),
});

export type AiTextImproverOutput = z.infer<typeof aiTextImproverOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Product Description                                                        */
/* -------------------------------------------------------------------------- */

export const aiProductDescriptionInputSchema = z
  .object({
    productName: z.string().trim().min(2).max(200),
    category: z.string().trim().max(120).optional(),
    features: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
    audience: z.string().trim().max(300).optional(),
    priceMinor: z.number().int().min(0).optional(),
    currency: currencyCodeSchema.optional(),
    platform: z.enum(AI_PRODUCT_PLATFORMS),
    tone: z.enum(AI_TONES),
    keywords: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
  })
  .strict()
  .refine((value) => (value.priceMinor === undefined) === (value.currency === undefined), {
    message: 'Provide both a price and a currency, or neither',
    path: ['currency'],
  });

export type AiProductDescriptionInput = z.infer<typeof aiProductDescriptionInputSchema>;

export const aiProductDescriptionOutputSchema = z.object({
  shortDescription: z.string().trim().min(1).max(600),
  longDescription: z.string().trim().min(1).max(4_000),
  bulletPoints: z.array(z.string().trim().min(1).max(200)).length(5),
  metaDescription: z.string().trim().min(1).max(160),
  keywords: z.array(z.string().trim().min(1).max(60)).max(8),
});

export type AiProductDescriptionOutput = z.infer<typeof aiProductDescriptionOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Business Name & Slogan                                                     */
/* -------------------------------------------------------------------------- */

export const aiBusinessNameInputSchema = z
  .object({
    industry: z.string().trim().min(2).max(200),
    audience: z.string().trim().max(200).optional(),
    style: z.enum(AI_NAME_STYLES),
    region: z.string().trim().max(120).optional(),
    language: z.enum(AI_LANGUAGE_CODES),
    includeWords: z.array(z.string().trim().min(1).max(40)).max(3).optional(),
    avoidWords: z.array(z.string().trim().min(1).max(40)).max(3).optional(),
  })
  .strict();

export type AiBusinessNameInput = z.infer<typeof aiBusinessNameInputSchema>;

export const aiBusinessNameOutputSchema = z.object({
  ideas: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(30),
        slogan: z.string().trim().min(1).max(90),
        rationale: z.string().trim().min(1).max(240),
        style: z.enum(AI_NAME_STYLES),
      }),
    )
    .length(10),
});

export type AiBusinessNameOutput = z.infer<typeof aiBusinessNameOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Social Caption                                                             */
/* -------------------------------------------------------------------------- */

export const aiSocialCaptionInputSchema = z
  .object({
    platform: z.enum(AI_SOCIAL_PLATFORMS),
    topic: z.string().trim().min(2).max(600),
    tone: z.enum(AI_TONES),
    audience: z.string().trim().max(200).optional(),
    callToAction: z.string().trim().max(200).optional(),
    hashtagCount: z.number().int().min(0).max(15).default(0),
    emoji: z.boolean().default(true),
    language: z.enum(AI_LANGUAGE_CODES),
  })
  .strict();

export type AiSocialCaptionInput = z.infer<typeof aiSocialCaptionInputSchema>;

export const aiSocialCaptionOutputSchema = z.object({
  captions: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(1_500),
        hashtags: z.array(z.string().trim().min(1).max(40)).max(15),
        characterCount: z.number().int().min(1).max(1_500),
      }),
    )
    .length(3),
});

export type AiSocialCaptionOutput = z.infer<typeof aiSocialCaptionOutputSchema>;

/* -------------------------------------------------------------------------- */
/* Business Plan Assistant                                                    */
/* -------------------------------------------------------------------------- */

export const aiBusinessPlanInputSchema = z
  .object({
    idea: z
      .string()
      .trim()
      .min(20, 'Describe the business idea in at least 20 characters')
      .max(2_000),
    market: z.string().trim().min(2).max(120),
    stage: z.enum(AI_PLAN_STAGES),
    audience: z.enum(AI_PLAN_AUDIENCES),
    sections: z.array(z.enum(AI_PLAN_SECTIONS)).min(1).max(AI_PLAN_SECTIONS.length),
    horizon: z.string().trim().max(80).optional(),
    budgetRange: z.string().trim().max(80).optional(),
    competitors: z.string().trim().max(600).optional(),
  })
  .strict();

export type AiBusinessPlanInput = z.infer<typeof aiBusinessPlanInputSchema>;

export const aiBusinessPlanOutputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(4_000),
        assumptions: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
      }),
    )
    .min(1)
    .max(12),
  nextSteps: z.array(z.string().trim().min(1).max(300)).max(8),
  disclaimer: z.string().trim().min(1).max(400),
});

export type AiBusinessPlanOutput = z.infer<typeof aiBusinessPlanOutputSchema>;
