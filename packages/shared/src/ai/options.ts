/**
 * Closed option sets for the AI tool forms and schemas.
 *
 * Every option is an enum rather than free text so the interface, the request
 * schema and the prompt all agree, and so a typo cannot silently become a
 * different instruction. Each list is intentionally short: more options are a
 * product decision with a test, not a configuration detail.
 */

export const AI_TONES = [
  'neutral',
  'professional',
  'friendly',
  'persuasive',
  'academic',
  'playful',
] as const;
export type AiTone = (typeof AI_TONES)[number];

export const AI_DOCUMENT_TYPES = [
  'letter',
  'article',
  'essay',
  'email',
  'report',
  'business-content',
] as const;
export type AiDocumentType = (typeof AI_DOCUMENT_TYPES)[number];

export const AI_LENGTHS = ['short', 'medium', 'long'] as const;
export type AiLength = (typeof AI_LENGTHS)[number];

export const AI_AD_PLATFORMS = [
  'instagram',
  'facebook',
  'google',
  'linkedin',
  'x',
  'flyer',
] as const;
export type AiAdPlatform = (typeof AI_AD_PLATFORMS)[number];

export const AI_AD_OBJECTIVES = ['awareness', 'leads', 'sales'] as const;
export type AiAdObjective = (typeof AI_AD_OBJECTIVES)[number];

export const AI_IMPROVER_GOALS = [
  'grammar',
  'clarity',
  'concise',
  'professional',
  'friendly',
  'academic',
] as const;
export type AiImproverGoal = (typeof AI_IMPROVER_GOALS)[number];

export const AI_LENGTH_PREFERENCES = ['shorter', 'similar', 'longer'] as const;
export type AiLengthPreference = (typeof AI_LENGTH_PREFERENCES)[number];

export const AI_PRODUCT_PLATFORMS = ['website', 'marketplace', 'social'] as const;
export type AiProductPlatform = (typeof AI_PRODUCT_PLATFORMS)[number];

export const AI_NAME_STYLES = ['modern', 'classic', 'playful', 'premium', 'local'] as const;
export type AiNameStyle = (typeof AI_NAME_STYLES)[number];

export const AI_SOCIAL_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok'] as const;
export type AiSocialPlatform = (typeof AI_SOCIAL_PLATFORMS)[number];

export const AI_PLAN_STAGES = ['idea', 'early', 'growing'] as const;
export type AiPlanStage = (typeof AI_PLAN_STAGES)[number];

export const AI_PLAN_AUDIENCES = ['bank', 'investor', 'internal'] as const;
export type AiPlanAudience = (typeof AI_PLAN_AUDIENCES)[number];

export const AI_PLAN_SECTIONS = [
  'summary',
  'problem',
  'solution',
  'market',
  'competition',
  'operations',
  'marketing',
  'financials',
  'risks',
  'next-steps',
] as const;
export type AiPlanSection = (typeof AI_PLAN_SECTIONS)[number];

export const AI_FORMALITIES = ['formal', 'neutral', 'casual'] as const;
export type AiFormality = (typeof AI_FORMALITIES)[number];
