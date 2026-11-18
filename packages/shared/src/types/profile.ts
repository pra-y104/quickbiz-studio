import type { SupportedLocale } from './locale';

/**
 * User profile. Mirrors the `public.profiles` table.
 *
 * `email` is mirrored from Supabase Auth for display only. It is not editable
 * from the profile screen; changing an email is an authentication operation.
 */
export interface Profile {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly preferredLocale: SupportedLocale;
  /** ISO 8601 timestamps, stored in UTC. */
  readonly createdAt: string;
  readonly updatedAt: string;
}
