import { useState } from 'react';
import { Link } from 'react-router';
import { MailCheck } from 'lucide-react';
import { registerSchema } from '@quickbiz/shared';
import { AUTH_COPY } from '../../content/auth';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Field } from '../../components/ui/field';
import { AuthShell } from '../../components/auth/auth-shell';
import { ConfigNotice } from '../../components/auth/config-notice';
import { PasswordField } from '../../components/auth/password-field';
import { PasswordStrength } from '../../components/auth/password-strength';
import { useAuth } from '../../lib/auth/auth-context';
import { messageForAuthError } from '../../lib/auth/messages';
import { emailCallbackUrl } from '../../lib/auth/urls';

type FieldErrors = Partial<
  Record<'email' | 'password' | 'confirmPassword' | 'acceptTerms', string>
>;

const EMPTY = {
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
};

export function RegisterPage() {
  const { gateway, status } = useAuth();
  const configured = status !== 'unconfigured' && gateway.configured;

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          key === 'email' ||
          key === 'password' ||
          key === 'confirmPassword' ||
          key === 'acceptTerms'
        ) {
          next[key] ??= issue.message;
        }
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      await gateway.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        emailRedirectTo: emailCallbackUrl(),
      });
      // The provider returns the same neutral result whether or not the address
      // already existed, so the screen cannot be used to enumerate accounts.
      setSentTo(parsed.data.email);
    } catch (error) {
      setFormError(messageForAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (!sentTo) return;
    setResending(true);
    setResent(false);
    try {
      await gateway.resendVerification({ email: sentTo, emailRedirectTo: emailCallbackUrl() });
    } catch (error) {
      setFormError(messageForAuthError(error));
    } finally {
      setResending(false);
      setResent(true);
    }
  }

  if (sentTo) {
    return (
      <AuthShell
        title={AUTH_COPY.register.successTitle}
        subtitle={AUTH_COPY.register.successBody}
        compact
        footer={
          <p className="text-center text-sm text-ink-muted">
            {AUTH_COPY.register.haveAccount}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {AUTH_COPY.register.signIn}
            </Link>
          </p>
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface-muted/50 p-5 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MailCheck className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">{sentTo}</span>
          </p>
          <p className="text-xs text-ink-subtle">
            The link expires. If it does, request another one below.
          </p>
        </div>

        {resent ? <Alert tone="info">{AUTH_COPY.register.resentNotice}</Alert> : null}
        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Button variant="outline" className="w-full" onClick={resend} loading={resending}>
          {AUTH_COPY.register.resendLink}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={AUTH_COPY.register.title}
      subtitle={AUTH_COPY.register.subtitle}
      footer={
        <p className="text-center text-sm text-ink-muted">
          {AUTH_COPY.register.haveAccount}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {AUTH_COPY.register.signIn}
          </Link>
        </p>
      }
    >
      {configured ? null : <ConfigNotice />}
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label={AUTH_COPY.common.emailLabel} htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
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
            mode="new"
            hint={AUTH_COPY.register.passwordHint}
            error={errors.password}
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
            disabled={!configured || submitting}
          />
          <PasswordStrength password={values.password} live={false} />
        </div>

        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label={AUTH_COPY.common.confirmPasswordLabel}
          mode="new"
          error={errors.confirmPassword}
          value={values.confirmPassword}
          onChange={(event) => update('confirmPassword', event.target.value)}
          disabled={!configured || submitting}
        />

        <div className="space-y-1.5">
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-muted">
            <input
              type="checkbox"
              name="acceptTerms"
              checked={values.acceptTerms}
              onChange={(event) => update('acceptTerms', event.target.checked)}
              disabled={!configured || submitting}
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? 'acceptTerms-error' : undefined}
              className="mt-0.5 size-4 rounded border-border-strong text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60"
            />
            <span>
              {AUTH_COPY.register.termsPrefix}{' '}
              <span className="font-medium text-ink">{AUTH_COPY.register.termsLink}</span>{' '}
              {AUTH_COPY.register.termsJoin}{' '}
              <span className="font-medium text-ink">{AUTH_COPY.register.privacyLink}</span>{' '}
              {AUTH_COPY.register.termsSuffix}
            </span>
          </label>
          {errors.acceptTerms ? (
            <p id="acceptTerms-error" role="alert" className="text-xs font-medium text-danger">
              {errors.acceptTerms}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" loading={submitting} disabled={!configured}>
          {AUTH_COPY.register.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
