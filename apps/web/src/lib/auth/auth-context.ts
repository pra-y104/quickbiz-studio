import { createContext, useContext } from 'react';
import type { AuthGateway, AuthSession, AuthStatus } from './types';

export interface AuthContextValue {
  readonly status: AuthStatus;
  readonly session: AuthSession | null;
  readonly gateway: AuthGateway;
  /** Re-read the session from the provider (used after recovery links). */
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Read the authentication state.
 *
 * Throws when used outside `AuthProvider`, which catches wiring mistakes during
 * development instead of silently rendering a signed-out UI.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

/**
 * Read the authentication state when a provider may be absent.
 *
 * Chrome that renders on both marketing and account pages (for example the mobile
 * tab bar) must not crash when it is mounted outside `AuthProvider`, so this
 * variant returns `null` instead of throwing. Components that require a session
 * must keep using `useAuth`.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
