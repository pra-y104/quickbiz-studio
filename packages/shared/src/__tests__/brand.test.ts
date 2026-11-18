import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_TAGLINE, BRAND } from '../index';

describe('brand configuration', () => {
  it('keeps the wordmark consistent with the product name', () => {
    expect(`${BRAND.wordmark.primary} ${BRAND.wordmark.secondary}`.trim()).toBe(BRAND.name);
  });

  it('exposes non-empty public copy', () => {
    expect(BRAND.name.length).toBeGreaterThan(0);
    expect(BRAND.tagline.length).toBeGreaterThan(10);
    expect(BRAND.shortDescription.length).toBeGreaterThan(30);
    expect(BRAND.platformNoun.length).toBeGreaterThan(2);
  });

  it('keeps legacy aliases in sync so a rename cannot drift', () => {
    expect(APP_NAME).toBe(BRAND.name);
    expect(APP_TAGLINE).toBe(BRAND.tagline);
  });
});
