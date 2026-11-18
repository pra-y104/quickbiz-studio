/**
 * Brand configuration - the single place to change the product name.
 *
 * The wordmark is split into two parts so the logo can style the suffix
 * differently (for example a lighter weight). Nothing else in the codebase
 * should hard-code the product name; use BRAND, or APP_NAME which mirrors it.
 *
 * Renaming procedure (also documented in docs/02-design-system.md):
 * 1. Change the four strings below.
 * 2. Update the wordmark split so primary + secondary still read as one name.
 * 3. Rebuild; the logo, header, footer, titles and copy all follow.
 */
export interface BrandConfig {
  /** Full product name used in prose and metadata. */
  readonly name: string;
  /** Visual split of the name for the wordmark component. */
  readonly wordmark: {
    readonly primary: string;
    readonly secondary: string;
  };
  readonly tagline: string;
  readonly shortDescription: string;
  /** Short noun used after the name, e.g. "the <platformNoun>". */
  readonly platformNoun: string;
}

export const BRAND: BrandConfig = {
  name: 'QuickBiz Studio',
  wordmark: {
    primary: 'QuickBiz',
    secondary: 'Studio',
  },
  tagline: 'Powerful Tools. Fair Pricing. No Surprises.',
  shortDescription:
    'AI-powered and everyday digital tools that help you finish useful work quickly and affordably.',
  platformNoun: 'studio',
};
