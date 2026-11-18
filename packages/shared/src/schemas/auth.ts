import { z } from 'zod';

/**
 * Shared authentication rules. The same schemas validate the browser form and
 * any server-side handling, so the rules cannot drift between the two.
 */

/** Pragmatic email check: one @, a dotted domain, no whitespace. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /\d/;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

export const emailSchema = z
  .string()
  .trim()
  .min(5, 'Enter your email address')
  .max(254, 'That email address is too long')
  .regex(EMAIL_PATTERN, 'Enter a valid email address')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer`)
  .regex(HAS_LETTER, 'Include at least one letter')
  .regex(HAS_DIGIT, 'Include at least one number');

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.literal(true, {
      message: 'You need to accept the terms to create an account',
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface PasswordStrength {
  /** 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong. */
  readonly score: 0 | 1 | 2 | 3 | 4;
  readonly label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  readonly met: {
    readonly length: boolean;
    readonly letter: boolean;
    readonly digit: boolean;
    readonly long: boolean;
    readonly mixedCase: boolean;
    readonly symbol: boolean;
  };
}

/**
 * Deterministic strength feedback. It is advice, not a second gate: the schema
 * above is what actually blocks submission.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  const met = {
    length: password.length >= PASSWORD_MIN_LENGTH,
    letter: HAS_LETTER.test(password),
    digit: HAS_DIGIT.test(password),
    long: password.length >= 14,
    mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const points = Object.values(met).filter(Boolean).length;
  if (password.length === 0) {
    return { score: 0, label: 'Too short', met };
  }
  if (!met.length) {
    return { score: 1, label: 'Too short', met };
  }

  const score: PasswordStrength['score'] = points >= 6 ? 4 : points >= 5 ? 3 : points >= 4 ? 2 : 1;
  const labels: Record<PasswordStrength['score'], PasswordStrength['label']> = {
    0: 'Too short',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };

  return { score, label: labels[score], met };
}
