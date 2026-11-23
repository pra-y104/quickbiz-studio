import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Profile, ProfileUpdateInput } from '@quickbiz/shared';
import { AuthProvider } from '../lib/auth/auth-provider';
import { LocaleProvider } from '../lib/locale/locale-provider';
import {
  AuthFailure,
  type AuthGateway,
  type AuthSession,
  type SignUpResult,
} from '../lib/auth/types';

export function makeSession(
  overrides: Partial<AuthSession['user']> = {},
  expiresAt: number | null = null,
): AuthSession {
  return {
    user: {
      id: 'user-1',
      email: 'ada@example.com',
      emailConfirmedAt: '2026-01-05T10:00:00.000Z',
      createdAt: '2026-01-01T09:00:00.000Z',
      ...overrides,
    },
    expiresAt,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    displayName: 'Ada Obi',
    avatarUrl: null,
    preferredLocale: 'en',
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-02T09:00:00.000Z',
    ...overrides,
  };
}

/**
 * In-memory gateway. Tests assert against the recorded calls, which is how we
 * prove that privileged fields never reach the profile update.
 */
export class FakeAuthGateway implements AuthGateway {
  readonly configured: boolean;
  session: AuthSession | null = null;
  profile: Profile | null = null;
  signUpResult: SignUpResult = { status: 'verification_sent', session: null };
  /** When set, every network-like operation rejects with this failure. */
  failWith: AuthFailure | null = null;
  /** Narrower failure switches so one broken call can be tested in isolation. */
  failProfileFetch = false;
  failProfileSave = false;
  failSignIn: AuthFailure | null = null;
  failPasswordUpdate: AuthFailure | null = null;

  lastSignUp: { email: string; password: string; emailRedirectTo: string } | null = null;
  lastSignIn: { email: string; password: string } | null = null;
  lastProfileUpdate: { userId: string; input: ProfileUpdateInput } | null = null;
  lastPassword: string | null = null;
  lastResetEmail: string | null = null;
  resendCalls = 0;
  signOutCalls = 0;

  private readonly listeners = new Set<(session: AuthSession | null) => void>();

  constructor(options: { configured?: boolean; session?: AuthSession | null } = {}) {
    this.configured = options.configured ?? true;
    this.session = options.session ?? null;
  }

  private maybeFail(): void {
    if (this.failWith) throw this.failWith;
  }

  async getSession(): Promise<AuthSession | null> {
    this.maybeFail();
    return this.session;
  }

  async getAccessToken(): Promise<string | null> {
    this.maybeFail();
    return this.session ? 'test-access-token' : null;
  }

  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(session: AuthSession | null): void {
    this.session = session;
    for (const listener of this.listeners) listener(session);
  }

  async signUp(input: {
    email: string;
    password: string;
    emailRedirectTo: string;
  }): Promise<SignUpResult> {
    this.maybeFail();
    this.lastSignUp = input;
    return this.signUpResult;
  }

  async resendVerification(): Promise<void> {
    this.maybeFail();
    this.resendCalls += 1;
  }

  async signIn(input: { email: string; password: string }): Promise<AuthSession> {
    if (this.failSignIn) throw this.failSignIn;
    this.maybeFail();
    this.lastSignIn = input;
    if (!this.signUpResult.session) {
      throw new AuthFailure('invalid_credentials', 'Invalid credentials');
    }
    return this.signUpResult.session;
  }

  async signOut(): Promise<void> {
    this.signOutCalls += 1;
    this.session = null;
  }

  async sendPasswordReset(input: { email: string; redirectTo: string }): Promise<void> {
    this.maybeFail();
    this.lastResetEmail = input.email;
  }

  async updatePassword(password: string): Promise<void> {
    if (this.failPasswordUpdate) throw this.failPasswordUpdate;
    this.maybeFail();
    this.lastPassword = password;
  }

  async fetchProfile(): Promise<Profile | null> {
    if (this.failProfileFetch) throw new Error('profile read failed');
    this.maybeFail();
    return this.profile;
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<Profile> {
    if (this.failProfileSave) throw new Error('profile save failed');
    this.maybeFail();
    this.lastProfileUpdate = { userId, input };
    const next = makeProfile({
      id: userId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ? input.avatarUrl : null,
      preferredLocale: input.preferredLocale,
    });
    this.profile = next;
    return next;
  }
}

export interface RenderWithAuthOptions {
  gateway?: FakeAuthGateway;
  initialEntries?: string[];
}

/** Renders UI inside the router and a fully controlled auth provider. */
export function renderWithAuth(ui: React.ReactNode, options: RenderWithAuthOptions = {}) {
  const gateway = options.gateway ?? new FakeAuthGateway();
  const result = render(
    <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>
      <LocaleProvider>
        <AuthProvider gateway={gateway}>{ui}</AuthProvider>
      </LocaleProvider>
    </MemoryRouter>,
  );
  return { ...result, gateway };
}
