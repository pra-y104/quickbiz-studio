import { describe, expect, it } from 'vitest';
import { stripInvisible } from './env';

/**
 * Regression guard for the blank-page incident: a Supabase URL pasted into the
 * dashboard carried a leading U+200E LEFT-TO-RIGHT MARK. That invisible
 * character survives String.trim() but makes `new URL(...)` throw, which
 * blanked the whole app at startup. `stripInvisible` must remove it.
 */
describe('stripInvisible', () => {
  it('removes a leading U+200E LEFT-TO-RIGHT MARK', () => {
    const contaminated = '\u200Ehttps://nrlldorsixhxvwzgzofn.supabase.co';
    expect(stripInvisible(contaminated)).toBe('https://nrlldorsixhxvwzgzofn.supabase.co');
  });

  it('removes zero-width and bidi formatting characters anywhere in the value', () => {
    const input = '\u200Bht\u200Dtps\u200F://example\u200E.supabase\uFEFF.co';
    expect(stripInvisible(input)).toBe('https://example.supabase.co');
  });

  it('trims surrounding whitespace', () => {
    expect(stripInvisible('  https://example.supabase.co  ')).toBe('https://example.supabase.co');
  });

  it('leaves a clean value unchanged', () => {
    const clean = 'https://nrlldorsixhxvwzgzofn.supabase.co';
    expect(stripInvisible(clean)).toBe(clean);
  });

  it('returns an empty string for a value made only of invisible characters', () => {
    expect(stripInvisible('\u200E\u200B\uFEFF')).toBe('');
  });
});
