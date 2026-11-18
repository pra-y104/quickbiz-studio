import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MailCheck } from 'lucide-react';
import { AUTH_COPY } from '../../content/auth';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { AuthShell } from '../../components/auth/auth-shell';
import { ConfigNotice } from '../../components/auth/config-notice';
import { useAuth } from '../../lib/auth/auth-context';
import { messageForAuthError } from '../../lib/auth/messages';
import { emailCallbackUrl } from '../../lib/auth/urls';

export function VerifyEmailPage() {
  const { gateway, status, session } = useAuth();
  const [searchParams] = useSearchParams();
  const configured = status !== 'unconfigured' && gateway.configured;

  const queryEmail = searchParams.get('email') ?? '';
  const knownEmail = (queryEmail || session?.user.email || '').trim().toLowerCase();

  // Held as an override so a session that resolves after mount still prefills the field.
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const email = emailOverride ?? knownEmail;
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function resend() {
    setFormError(null);
    setResent(false);

    const target = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(target)) {
      setFieldError('Enter the email address you registered with');
      return;
    }
    setFieldError(undefined);
    setResending(true);
    try {
      await gateway.resendVerification({ email: target, emailRedirectTo: emailCallbackUrl() });
      setResent(true);
    } catch (error) {
      setFormError(messageForAuthError(error));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title={AUTH_COPY.verify.title}
      subtitle={AUTH_COPY.verify.subtitle}
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

      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface-muted/50 p-5 text-center">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm leading-relaxed text-ink-muted">{AUTH_COPY.verify.body}</p>
      </div>

      {resent ? <Alert tone="info">{AUTH_COPY.verify.resent}</Alert> : null}
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div className="space-y-4">
        <Field
          label={AUTH_COPY.common.emailLabel}
          htmlFor="verify-email"
          error={fieldError}
          required
        >
          <Input
            id="verify-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => {
              setEmailOverride(event.target.value);
              setFieldError(undefined);
            }}
            disabled={!configured || resending}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'verify-email-error' : undefined}
          />
        </Field>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={resend}
          loading={resending}
          disabled={!configured}
        >
          {AUTH_COPY.verify.resend}
        </Button>
      </div>

      {session?.user.email ? (
        <p className="text-center text-[11px] text-ink-subtle">
          {AUTH_COPY.verify.signedInAs} <span className="text-ink-muted">{session.user.email}</span>
        </p>
      ) : null}
    </AuthShell>
  );
}
