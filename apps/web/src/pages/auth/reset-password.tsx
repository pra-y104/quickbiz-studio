import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { resetPasswordSchema } from '@quickbiz/shared';
import { AUTH_COPY } from '../../content/auth';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { AuthShell } from '../../components/auth/auth-shell';
import { ConfigNotice } from '../../components/auth/config-notice';
import { PasswordField } from '../../components/auth/password-field';
import { PasswordStrength } from '../../components/auth/password-strength';
import { AuthLoading } from '../../components/auth/route-guards';
import { useAuth } from '../../lib/auth/auth-context';
import { messageForAuthError } from '../../lib/auth/messages';

type Stage = 'checking' | 'form' | 'invalid' | 'success';
type FieldErrors = Partial<Record<'password' | 'confirmPassword', string>>;

/** How long to wait for the recovery token exchange before rejecting the link. */
const LINK_GRACE_MS = 1800;

export function ResetPasswordPage() {
  const { gateway, status, session } = useAuth();
  const [expired, setExpired] = useState(false);
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status !== 'ready' || session) return;

    // The provider consumes the recovery token in the URL fragment after load.
    // Give that a moment before declaring the link unusable.
    const timer = window.setTimeout(() => setExpired(true), LINK_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [status, session]);

  // Derived, not stored: the screen follows the session that the provider owns.
  const stage: Stage = saved
    ? 'success'
    : status === 'unconfigured' || expired
      ? 'invalid'
      : session
        ? 'form'
        : 'checking';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'password' || key === 'confirmPassword') next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await gateway.updatePassword(parsed.data.password);
      setPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (error) {
      setFormError(messageForAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === 'checking') {
    return (
      <AuthShell title={AUTH_COPY.reset.title} subtitle={AUTH_COPY.reset.subtitle} compact>
        <AuthLoading label="Checking your reset link" />
      </AuthShell>
    );
  }

  if (stage === 'invalid') {
    return (
      <AuthShell
        title={AUTH_COPY.reset.invalidTitle}
        subtitle={AUTH_COPY.reset.invalidBody}
        compact
        footer={
          <p className="text-center text-sm text-ink-muted">
            <Link to="/login" className="font-medium text-primary hover:underline">
              {AUTH_COPY.forgot.backToLogin}
            </Link>
          </p>
        }
      >
        {status === 'unconfigured' ? <ConfigNotice /> : null}
        <div className="flex flex-col items-center gap-3 rounded-card border border-danger/25 bg-danger-soft/60 p-5 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-danger">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <p className="text-xs leading-relaxed text-ink-muted">
            Reset links can only be used once and expire quickly. Nothing about your account has
            changed.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link to="/forgot-password">{AUTH_COPY.reset.requestNew}</Link>
        </Button>
      </AuthShell>
    );
  }

  if (stage === 'success') {
    const destination = session ? '/dashboard' : '/login';
    return (
      <AuthShell
        title={AUTH_COPY.reset.successTitle}
        subtitle={AUTH_COPY.reset.successBody}
        compact
        footer={
          <p className="text-center text-sm text-ink-muted">
            <Link to={destination} className="font-medium text-primary hover:underline">
              {session ? AUTH_COPY.reset.continue : AUTH_COPY.forgot.backToLogin}
            </Link>
          </p>
        }
      >
        <Alert tone="success">{AUTH_COPY.reset.successBody}</Alert>
        <Button asChild className="w-full">
          <Link to={destination}>
            {session ? AUTH_COPY.reset.continue : AUTH_COPY.forgot.backToLogin}
          </Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={AUTH_COPY.reset.title}
      subtitle={AUTH_COPY.reset.subtitle}
      compact
      footer={
        <p className="text-center text-sm text-ink-muted">
          <Link to="/login" className="font-medium text-primary hover:underline">
            {AUTH_COPY.forgot.backToLogin}
          </Link>
        </p>
      }
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <PasswordField
            id="password"
            name="password"
            label={AUTH_COPY.common.passwordLabel}
            mode="new"
            error={errors.password}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            disabled={submitting}
          />
          <PasswordStrength password={password} live={false} />
        </div>

        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label={AUTH_COPY.common.confirmPasswordLabel}
          mode="new"
          error={errors.confirmPassword}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setErrors((current) => ({ ...current, confirmPassword: undefined }));
          }}
          disabled={submitting}
        />

        <Button type="submit" className="w-full" loading={submitting}>
          {AUTH_COPY.reset.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
