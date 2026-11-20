/**
 * Creative Studio feature flags.
 *
 * These are compile-time decisions, not configuration: the studio is either part
 * of this build or it is not, and AI features stay off until the separate AI
 * milestones are approved and reviewed. Keeping them here means no route, bundle
 * or environment variable can switch paid behaviour on by accident.
 */

export const CREATIVE_STUDIO_FLAGS = {
  /** The editor itself. Local-only, no provider, no cost. */
  studio: true,
  /**
   * AI text assistance. Requires the Stage 6 M1B provider work to be merged,
   * reviewed and approved, plus a quota design (D3) and pricing (D15).
   * Until then this flag stays false and the UI explains why.
   */
  aiText: false,
  /**
   * AI image generation. Requires a separately approved and funded provider,
   * its own registry, and an owner decision on per-image cost.
   */
  aiImage: false,
} as const;

export type CreativeStudioFlag = keyof typeof CREATIVE_STUDIO_FLAGS;

export function isCreativeStudioEnabled(): boolean {
  return CREATIVE_STUDIO_FLAGS.studio;
}

export function isAiTextEnabled(): boolean {
  return CREATIVE_STUDIO_FLAGS.aiText;
}

export function isAiImageEnabled(): boolean {
  return CREATIVE_STUDIO_FLAGS.aiImage;
}

/**
 * Why an AI feature is unavailable, in words a customer can read.
 * Returned instead of a dead button so the interface never pretends.
 */
export function aiTextUnavailableReason(): string {
  return 'AI writing assistance is not available yet. You can still write and edit every element by hand.';
}

export function aiImageUnavailableReason(): string {
  return 'AI image generation is not available yet. Upload your own images or use the shapes and templates.';
}