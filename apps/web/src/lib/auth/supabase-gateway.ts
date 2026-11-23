import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, ProfileUpdateInput, SupportedLocale } from '@quickbiz/shared';
import { env } from '../env';
import { AuthFailure, type AuthGateway, type AuthSession, type SignUpResult } from './types';

/**
 * Supabase-backed authentication.
 *
 * Only the public project URL and anon key are used here. The service-role key
 * is a server secret and must never appear in this bundle; profile writes rely
 * on Row Level Security instead.
 */

const PROFILE_COLUMNS =
  'id, email, display_name, avatar_url, preferred_locale, created_at, updated_at';

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  preferred_locale: string;
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email ?? '',
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    preferredLocale: row.preferred_locale as SupportedLocale,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/** Maps provider error codes onto our own, so screens never parse raw strings. */
export function mapSupabaseError(error: SupabaseErrorLike): AuthFailure {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();

  const network = error.status === 0 || /fetch|network|failed to fetch/.test(message);
  if (network) {
    return new AuthFailure('network', 'Could not reach the authentication service', {
      cause: error,
    });
  }

  switch (code) {
    case 'invalid_credentials':
      return new AuthFailure('invalid_credentials', 'Invalid email or password', { cause: error });
    case 'email_not_confirmed':
      return new AuthFailure('email_not_verified', 'Email address is not confirmed', {
        cause: error,
      });
    case 'user_already_exists':
    case 'email_exists':
      return new AuthFailure('already_registered', 'That email address is already registered', {
        cause: error,
      });
    case 'weak_password':
      return new AuthFailure('weak_password', 'That password is too weak', { cause: error });
    case 'same_password':
      return new AuthFailure('same_password', 'That password has been used before', {
        cause: error,
      });
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return new AuthFailure('rate_limited', 'Too many attempts', { cause: error });
    case 'otp_expired':
      return new AuthFailure('expired_link', 'That link has expired', { cause: error });
    default:
      break;
  }

  if (/expired|invalid.*token|token.*invalid/.test(message)) {
    return new AuthFailure('expired_link', 'That link is no longer valid', { cause: error });
  }
  if (/rate limit|too many/.test(message)) {
    return new AuthFailure('rate_limited', 'Too many attempts', { cause: error });
  }

  return new AuthFailure('unknown', error.message ?? 'Authentication failed', { cause: error });
}

function toSession(
  session: {
    expires_at?: number | null;
    user: {
      id: string;
      email?: string | null;
      email_confirmed_at?: string | null;
      created_at?: string | null;
    };
  } | null,
): AuthSession | null {
  if (!session) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      emailConfirmedAt: session.user.email_confirmed_at ?? null,
      createdAt: session.user.created_at ?? null,
    },
    expiresAt: session.expires_at ?? null,
  };
}

export class SupabaseAuthGateway implements AuthGateway {
  readonly configured = true;

  private client: SupabaseClient | null = null;

  private get supabase(): SupabaseClient {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new AuthFailure('not_configured', 'Supabase is not configured');
    }
    if (!this.client) {
      this.client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The email confirmation and recovery links carry tokens in the URL
          // fragment; detectSessionInUrl lets the client consume them on load.
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      });
    }
    return this.client;
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw mapSupabaseError(error);
    return toSession(data.session);
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      listener(toSession(session));
    });
    return () => data.subscription.unsubscribe();
  }

  async signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<SignUpResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: input.emailRedirectTo },
    });
    if (error) throw mapSupabaseError(error);

    // Supabase returns an obfuscated user with no identities for an address that
    // already exists. Report the same neutral result in both cases.
    const session = toSession(data.session);
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { status: 'verification_sent', session: null };
    }

    return session
      ? { status: 'signed_in', session }
      : { status: 'verification_sent', session: null };
  }

  async resendVerification(input: { email: string; emailRedirectTo: string }): Promise<void> {
    const { error } = await this.supabase.auth.resend({
      type: 'signup',
      email: input.email,
      options: { emailRedirectTo: input.emailRedirectTo },
    });
    if (error) throw mapSupabaseError(error);
  }

  async signIn(input: { email: string; password: string }): Promise<AuthSession> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error) throw mapSupabaseError(error);
    const session = toSession(data.session);
    if (!session) {
      throw new AuthFailure('unknown', 'Sign in did not return a session');
    }
    return session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw mapSupabaseError(error);
  }

  async sendPasswordReset(input: { email: string; redirectTo: string }): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: input.redirectTo,
    });
    if (error) throw mapSupabaseError(error);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password });
    if (error) throw mapSupabaseError(error);
  }

  async fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle<ProfileRow>();
    if (error) throw mapSupabaseError(error);
    return data ? toProfile(data) : null;
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<Profile> {
    // The payload contains only editable columns; RLS and column grants reject
    // anything else even if a caller crafts the request by hand.
    const { data, error } = await this.supabase
      .from('profiles')
      .update({
        display_name: input.displayName,
        avatar_url: input.avatarUrl ? input.avatarUrl : null,
        preferred_locale: input.preferredLocale,
      })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single<ProfileRow>();
    if (error) throw mapSupabaseError(error);
    return toProfile(data);
  }
}
