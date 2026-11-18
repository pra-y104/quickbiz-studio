import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../types/locale';

/**
 * Fields a user is allowed to change on their own profile.
 * Privileged columns (id, email, created_at, timestamps, credits) are absent by
 * design; the database grants column-level update rights to match this list.
 */
export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters')
    .max(60, 'Use 60 characters or fewer'),
  avatarUrl: z
    .string()
    .trim()
    .max(500, 'That URL is too long')
    .refine((value) => value === '' || /^https:\/\/[^\s]+$/i.test(value), {
      message: 'Use a secure https:// image URL',
    })
    .optional()
    .or(z.literal('')),
  preferredLocale: z.enum(SUPPORTED_LOCALES),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
