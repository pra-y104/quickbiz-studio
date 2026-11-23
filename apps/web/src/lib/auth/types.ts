import type { Profile, ProfileUpdateInput } from '@quickbiz/shared';

export type AuthStatus = 'loading' | 'ready' | 'unconfigured';

export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
  /** ISO timestamp when Supabase confirmed the address, or null. */
  readonly emailConfirmedAt: string | null;
  readonly createdAt: string | null;
}

export interface AuthSession {
  readonly user: AuthUser;
  /** Unix seconds, or null when the provider does not expose it. */
  readonly expiresAt: number | null;
}

export type AuthFailureCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'already_registered'
  | 'weak_password'
  | 'same_password'
  | 'rate_limited'
  | 'expired_link'
  | 'not_configured'
  | 'network'
  | 'unknown';

/** Typed authentication failure so the UI never has to parse provider strings. */
export class AuthFailure extends Error {
  readonly code: AuthFailureCode;

  constructor(code: AuthFailureCode, message: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'AuthFailure';
    this.code = code;
  }
}

export interface SignUpResult {
  /**
   * `verification_sent` is returned for both new and existing addresses so the
   * screen cannot be used to discover which emails are registered.
   */
  readonly status: 'verification_sent' | 'signed_in';
  readonly session: AuthSession | null;
}

/**
 * Everything the UI needs from an authentication provider.
 *
 * The Supabase implementation is the production one. Keeping the contract here
 * means protected routes and forms can be tested without network access, and a
 * different provider could be substituted later without touching the screens.
 */
export interface AuthGateway {
  readonly configured: boolean;
  getSession(): Promise<AuthSession | null>;
  /** Short-lived access token for authenticated API calls, or null. */
  getAccessToken(): Promise<string | null>;
  /** Subscribe to session changes. Returns an unsubscribe function. */
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void;
  signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<SignUpResult>;
  resendVerification(input: { email: string; emailRedirectTo: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<AuthSession>;
  signOut(): Promise<void>;
  sendPasswordReset(input: { email: string; redirectTo: string }): Promise<void>;
  /** Requires an active recovery (or normal) session. */
  updatePassword(password: string): Promise<void>;
  fetchProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, input: ProfileUpdateInput): Promise<Profile>;
}
