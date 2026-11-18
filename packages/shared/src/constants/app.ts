/**
 * Core brand constants. Single source of truth for names used across web and API.
 * Values here are public and safe to ship in the browser bundle.
 */
export const APP_NAME = 'QuickBiz Studio';
export const APP_TAGLINE = 'Powerful Tools. Fair Pricing. No Surprises.';
export const APP_SHORT_DESCRIPTION =
  'AI-powered and everyday digital tools that help you finish useful work quickly and affordably.';

/** Market configuration is data, not assumptions. Nigeria is the first payment market. */
export const DEFAULT_CURRENCY = 'NGN' as const;
export const DEFAULT_LOCALE = 'en' as const;
export const DEFAULT_TIMEZONE = 'UTC' as const;
