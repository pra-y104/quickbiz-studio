import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { AUTH_COPY } from '../../content/auth';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { AuthShell } from '../../components/auth/auth-shell';
import { AuthLoading } from '../../components/auth/route-guards';
import { useAuth } from '../../lib/auth/auth-context';
import { safeNextPath } from '../../lib/auth/redirect';

/** After this long without a session, treat the confirmation link as unusable. */
const LINK_GRACE_MS = 1800;

/**
 * Landing page for email confirmation links.
 *
 * Supabase consumes the token from the URL, so the page waits for the session
 * rather than parsing tokens itself. It never invents a session.
 */
export function AuthCallbackPage() {
  const { status, session } = useAuth();
  const [searchParams] = useSearchParams();
  const destination = safeNextPath(searchParams.get('next'));
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (status !== 'ready' || session) return;
    const timer = window.setTimeout(() => setExpired(true), LINK_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [status, session]);

  if (session) {
    return <Navigate to={destination} replace />;
  }

  if (status === 'loading' || !expired) {
    return (
      <AuthShell title="Confirming your email" subtitle="This only takes a moment." compact>
        <AuthLoading label="Completing sign in" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={AUTH_COPY.errors.expiredLink}
      subtitle="Confirmation links are single-use and time-limited."
      compact
      footer={
        <p className="text-center text-sm text-ink-muted">
          <Link to="/login" className="font-medium text-primary hover:underline">
            {AUTH_COPY.forgot.backToLogin}
          </Link>
        </p>
      }
    >
      <Alert tone="warning">{AUTH_COPY.errors.expiredLink}</Alert>
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface-muted/50 p-5 text-center">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-warning">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </span>
        <p className="text-xs leading-relaxed text-ink-muted">
          Request a fresh confirmation email from the verification screen, then open the newest link
          on this device.
        </p>
      </div>
      <Button asChild className="w-full">
        <Link to="/verify-email">{AUTH_COPY.verify.resend}</Link>
      </Button>
    </AuthShell>
  );
}
