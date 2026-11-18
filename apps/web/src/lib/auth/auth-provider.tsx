import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAuthGateway } from './gateway';
import { AuthContext, type AuthContextValue } from './auth-context';
import type { AuthGateway, AuthSession, AuthStatus } from './types';

export interface AuthProviderProps {
  children: ReactNode;
  /** Test seam: inject a fake gateway instead of the environment-based one. */
  gateway?: AuthGateway;
}

/**
 * Holds the authentication session for the whole application.
 *
 * The initial state is always `loading`, never "signed out", because a stored
 * session is restored asynchronously. Protected routes wait for this rather than
 * flashing a redirect on every refresh.
 */
export function AuthProvider({ children, gateway: providedGateway }: AuthProviderProps) {
  const gateway = useMemo(() => providedGateway ?? getAuthGateway(), [providedGateway]);
  const [status, setStatus] = useState<AuthStatus>(gateway.configured ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<AuthSession | null>(null);

  const refresh = useCallback(async () => {
    if (!gateway.configured) {
      setStatus('unconfigured');
      setSession(null);
      return;
    }
    try {
      const next = await gateway.getSession();
      setSession(next);
      setStatus('ready');
    } catch {
      // A broken or unreachable auth service is treated as signed out, but the
      // app stays usable and the sign-in screen reports the real error.
      setSession(null);
      setStatus('ready');
    }
  }, [gateway]);

  useEffect(() => {
    let active = true;

    // `gateway.configured` is fixed for the lifetime of the provider; the initial
    // state already reflects it, so an unconfigured build needs no session read.
    if (!gateway.configured) {
      return;
    }

    // Session reads resolve asynchronously, so the first paint stays in the
    // loading state instead of flashing a signed-out UI.
    gateway
      .getSession()
      .then((next) => {
        if (!active) return;
        setSession(next);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setStatus('ready');
      });

    const unsubscribe = gateway.onAuthStateChange((next) => {
      if (!active) return;
      setSession(next);
      setStatus('ready');
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway]);

  const signOut = useCallback(async () => {
    // Clear the local session even if the provider call fails, so the UI cannot
    // stay stuck in a signed-in state after a logout attempt.
    try {
      await gateway.signOut();
    } finally {
      setSession(null);
      setStatus('ready');
    }
  }, [gateway]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, gateway, refresh, signOut }),
    [status, session, gateway, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
