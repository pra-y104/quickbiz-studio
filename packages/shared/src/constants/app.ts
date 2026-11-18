import { BRAND } from './brand';

/**
 * Legacy convenience constants derived from BRAND.
 * New code should import BRAND directly so a rename only touches one file.
 */
export const APP_NAME = BRAND.name;
export const APP_TAGLINE = BRAND.tagline;
export const APP_SHORT_DESCRIPTION = BRAND.shortDescription;

/** Market configuration is data, not assumptions. Nigeria is the first payment market. */
export const DEFAULT_CURRENCY = 'NGN' as const;
export const DEFAULT_LOCALE = 'en' as const;
export const DEFAULT_TIMEZONE = 'UTC' as const;
