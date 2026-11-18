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
