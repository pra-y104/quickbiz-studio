import { AuthFailure, type AuthGateway } from './types';

/**
 * Used when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are absent.
 *
 * Every operation fails with `not_configured`. Nothing is faked: no session, no
 * profile, no "success" message. Screens read `configured` and disable their
 * forms, so a developer notices the missing configuration immediately.
 */
export class UnconfiguredAuthGateway implements AuthGateway {
  readonly configured = false;

  private fail(): never {
    throw new AuthFailure('not_configured', 'Authentication is not configured in this build');
  }

  async getSession(): Promise<null> {
    return null;
  }

  async getAccessToken(): Promise<null> {
    return null;
  }

  onAuthStateChange(): () => void {
    return () => {};
  }

  async signUp(): Promise<never> {
    return this.fail();
  }

  async resendVerification(): Promise<never> {
    return this.fail();
  }

  async signIn(): Promise<never> {
    return this.fail();
  }

  async signOut(): Promise<void> {
    return undefined;
  }

  async sendPasswordReset(): Promise<never> {
    return this.fail();
  }

  async updatePassword(): Promise<never> {
    return this.fail();
  }

  async fetchProfile(): Promise<null> {
    return null;
  }

  async updateProfile(): Promise<never> {
    return this.fail();
  }
}
