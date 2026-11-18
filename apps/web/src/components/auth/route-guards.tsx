import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { AUTH_COPY } from '../../content/auth';
import { Spinner } from '../ui/spinner';
import { useAuth } from '../../lib/auth/auth-context';
import { currentPathWithSearch, safeNextPath } from '../../lib/auth/redirect';

/** Full-page state while the stored session is restored. */
export function AuthLoading({ label = 'Checking your session' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60dvh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-6 text-primary" />
      <p className="text-sm text-ink-muted">{label}</p>
    </div>
  );
}

/**
 * Protects account routes.
 *
 * Order matters: the session is restored before any redirect is decided, so a
 * refresh on `/dashboard` does not bounce a signed-in person to `/login`.
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status, session } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <AuthLoading />;
  }

  if (!session) {
    const next = encodeURIComponent(currentPathWithSearch(location));
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

/**
 * Keeps signed-in people away from sign-in and sign-up screens.
 *
 * `status === 'loading'` shows the same loading state rather than the form, which
 * avoids a visible flash of the login page before the redirect lands.
 */
export function RedirectIfAuthenticated({ children }: { children?: ReactNode }) {
  const { status, session } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <AuthLoading />;
  }

  if (session) {
    const requested = new URLSearchParams(location.search).get('next');
    return <Navigate to={safeNextPath(requested)} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

/**
 * Placeholder for screens that require a working auth provider.
 * It never renders a signed-in appearance when configuration is missing.
 */
export function AuthUnavailable() {
  return (
    <div className="mx-auto w-full max-w-md rounded-card border border-warning/30 bg-warning-soft/60 p-5 text-sm">
      <h2 className="font-semibold text-ink">{AUTH_COPY.common.notConfiguredTitle}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
        {AUTH_COPY.common.notConfiguredBody}
      </p>
    </div>
  );
}
