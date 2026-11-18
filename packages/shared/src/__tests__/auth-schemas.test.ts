import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  getPasswordStrength,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../schemas/auth';
import { profileUpdateSchema } from '../schemas/profile';

const VALID = {
  email: '  Owner@Example.COM ',
  password: 'correct-horse-1',
  confirmPassword: 'correct-horse-1',
  acceptTerms: true as const,
};

describe('registration schema', () => {
  it('accepts a valid signup and normalises the email', () => {
    const parsed = registerSchema.parse(VALID);
    expect(parsed.email).toBe('owner@example.com');
  });

  it('rejects short passwords, missing numbers and mismatched confirmation', () => {
    expect(
      registerSchema.safeParse({ ...VALID, password: 'short1', confirmPassword: 'short1' }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        ...VALID,
        password: 'onlylettershere',
        confirmPassword: 'onlylettershere',
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ ...VALID, confirmPassword: 'different-pass-2' }).success,
    ).toBe(false);
  });

  it('requires explicit terms acceptance', () => {
    const result = registerSchema.safeParse({ ...VALID, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  it('reports which field failed', () => {
    const result = registerSchema.safeParse({ ...VALID, confirmPassword: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });
});

describe('login and reset schemas', () => {
  it('requires a password but does not enforce signup rules on login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('validates reset confirmation', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'long-enough-9', confirmPassword: 'long-enough-9' })
        .success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ password: 'long-enough-9', confirmPassword: 'mismatch-9' })
        .success,
    ).toBe(false);
  });

  it('rejects malformed emails', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('two@@dots.com').success).toBe(false);
  });
});

describe('password strength guidance', () => {
  it('scores from empty to strong', () => {
    expect(getPasswordStrength('').score).toBe(0);
    expect(getPasswordStrength('abc').label).toBe('Too short');
    expect(getPasswordStrength('alllowercase1').score).toBeLessThan(4);
    expect(getPasswordStrength('Str0ng-Passphrase-2026').score).toBe(4);
  });

  it('reports which requirements are met', () => {
    const result = getPasswordStrength('Correct-Horse-1');
    expect(result.met.length).toBe(true);
    expect(result.met.letter).toBe(true);
    expect(result.met.digit).toBe(true);
    expect(result.met.symbol).toBe(true);
  });
});

describe('profile update schema', () => {
  it('accepts the editable fields only', () => {
    const parsed = profileUpdateSchema.parse({
      displayName: 'Ada Obi',
      avatarUrl: 'https://example.com/me.png',
      preferredLocale: 'en',
    });
    expect(parsed.displayName).toBe('Ada Obi');
  });

  it('allows an empty avatar but rejects insecure or script URLs', () => {
    expect(
      profileUpdateSchema.safeParse({ displayName: 'Ada', avatarUrl: '', preferredLocale: 'en' })
        .success,
    ).toBe(true);
    expect(
      profileUpdateSchema.safeParse({
        displayName: 'Ada',
        avatarUrl: 'javascript:alert(1)',
        preferredLocale: 'en',
      }).success,
    ).toBe(false);
    expect(
      profileUpdateSchema.safeParse({
        displayName: 'Ada',
        avatarUrl: 'http://example.com/me.png',
        preferredLocale: 'en',
      }).success,
    ).toBe(false);
  });

  it('ignores privileged keys instead of accepting them', () => {
    const parsed = profileUpdateSchema.parse({
      displayName: 'Ada',
      preferredLocale: 'en',
      id: 'attacker-chosen',
      email: 'attacker@example.com',
    } as unknown);
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('email');
  });

  it('rejects unknown locales and too-short names', () => {
    expect(profileUpdateSchema.safeParse({ displayName: 'A', preferredLocale: 'en' }).success).toBe(
      false,
    );
    expect(
      profileUpdateSchema.safeParse({ displayName: 'Ada', preferredLocale: 'xx' }).success,
    ).toBe(false);
  });
});
