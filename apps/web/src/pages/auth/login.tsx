import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { loginSchema } from '@quickbiz/shared';
import { AUTH_COPY } from '../../content/auth';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { AuthShell } from '../../components/auth/auth-shell';
import { ConfigNotice } from '../../components/auth/config-notice';
import { PasswordField } from '../../components/auth/password-field';
import { useAuth } from '../../lib/auth/auth-context';
import { AuthFailure } from '../../lib/auth/types';
import { messageForAuthError, messageForSignInError } from '../../lib/auth/messages';
import { safeNextPath } from '../../lib/auth/redirect';
import { emailCallbackUrl } from '../../lib/auth/urls';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

export function LoginPage() {
  const { gateway, status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const configured = status !== 'unconfigured' && gateway.configured;
  const nextPath = safeNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setUnverified(false);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'email' || key === 'password') next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await gateway.signIn({ email: parsed.data.email, password: parsed.data.password });
      navigate(nextPath, { replace: true });
    } catch (error) {
      if (error instanceof AuthFailure && error.code === 'email_not_verified') {
        setUnverified(true);
        setFormError(messageForAuthError(error));
      } else {
        setFormError(messageForSignInError(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    setResending(true);
    setResent(false);
    try {
      await gateway.resendVerification({
        email: email.trim().toLowerCase(),
        emailRedirectTo: emailCallbackUrl(),
      });
    } catch (error) {
      setFormError(messageForAuthError(error));
    } finally {
      setResending(false);
      setResent(true);
    }
  }

  return (
    <AuthShell
      title={AUTH_COPY.login.title}
      subtitle={AUTH_COPY.login.subtitle}
      footer={
        <p className="text-center text-sm text-ink-muted">
          {AUTH_COPY.login.noAccount}{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {AUTH_COPY.login.createAccount}
          </Link>
        </p>
      }
    >
      {configured ? null : <ConfigNotice />}
      {formError ? <Alert tone={unverified ? 'warning' : 'danger'}>{formError}</Alert> : null}
      {resent ? <Alert tone="info">{AUTH_COPY.register.resentNotice}</Alert> : null}

      {unverified ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={resendVerification}
          loading={resending}
        >
          {AUTH_COPY.login.resendVerification}
        </Button>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label={AUTH_COPY.common.emailLabel} htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            disabled={!configured || submitting}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
        </Field>

        <div className="space-y-2">
          <PasswordField
            id="password"
            name="password"
            label={AUTH_COPY.common.passwordLabel}
            value={password}
            error={errors.password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            disabled={!configured || submitting}
          />
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              {AUTH_COPY.login.forgot}
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" loading={submitting} disabled={!configured}>
          {AUTH_COPY.login.submit}
        </Button>
      </form>

      <p className="text-center text-[11px] leading-relaxed text-ink-subtle">
        Sessions are stored in this browser and refresh in the background. Signing out clears them
        from this device.
      </p>
    </AuthShell>
  );
}
