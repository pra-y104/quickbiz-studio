import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { MailCheck } from 'lucide-react';
import { forgotPasswordSchema } from '@quickbiz/shared';
import { AUTH_COPY } from '../../content/auth';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { AuthShell } from '../../components/auth/auth-shell';
import { ConfigNotice } from '../../components/auth/config-notice';
import { useAuth } from '../../lib/auth/auth-context';
import { messageForAuthError } from '../../lib/auth/messages';
import { passwordRecoveryUrl } from '../../lib/auth/urls';

export function ForgotPasswordPage() {
  const { gateway, status } = useAuth();
  const configured = status !== 'unconfigured' && gateway.configured;

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);

    setSubmitting(true);
    try {
      await gateway.sendPasswordReset({
        email: parsed.data.email,
        redirectTo: passwordRecoveryUrl(),
      });
      // Always the same response, whatever the provider says about the address.
      setSent(true);
    } catch (error) {
      setFormError(messageForAuthError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={sent ? AUTH_COPY.forgot.successTitle : AUTH_COPY.forgot.title}
      subtitle={sent ? AUTH_COPY.forgot.successBody : AUTH_COPY.forgot.subtitle}
      compact
      footer={
        <p className="text-center text-sm text-ink-muted">
          <Link to="/login" className="font-medium text-primary hover:underline">
            {AUTH_COPY.forgot.backToLogin}
          </Link>
        </p>
      }
    >
      {configured ? null : <ConfigNotice />}
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface-muted/50 p-5 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MailCheck className="size-5" aria-hidden="true" />
          </span>
          <p className="text-xs leading-relaxed text-ink-subtle">
            One email only, with a single-use link. Check the spam folder before requesting another.
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <Field label={AUTH_COPY.common.emailLabel} htmlFor="email" error={fieldError} required>
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
                setFieldError(undefined);
              }}
              disabled={!configured || submitting}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'email-error' : undefined}
            />
          </Field>

          <Button type="submit" className="w-full" loading={submitting} disabled={!configured}>
            {AUTH_COPY.forgot.submit}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
