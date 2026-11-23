import { useEffect, useState, type FormEvent } from 'react';
import { BadgeCheck, MailWarning, RefreshCw } from 'lucide-react';
import {
  LOCALES,
  SUPPORTED_LOCALES,
  formatDate,
  formatMoney,
  intlLocaleFor,
  profileUpdateSchema,
  type Profile,
} from '@quickbiz/shared';
import { AUTH_COPY } from '../content/auth';
import { Alert } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Field } from '../components/ui/field';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { AccountShell } from '../components/account/account-shell';
import { useAuth } from '../lib/auth/auth-context';
import { useLocale } from '../lib/locale/locale-provider';
import { messageForAuthError } from '../lib/auth/messages';

type FieldErrors = Partial<Record<'displayName' | 'avatarUrl' | 'preferredLocale', string>>;
type LoadState = 'loading' | 'ready' | 'missing' | 'error';

interface FormValues {
  displayName: string;
  avatarUrl: string;
  preferredLocale: string;
}

const EMPTY_FORM: FormValues = { displayName: '', avatarUrl: '', preferredLocale: 'en' };

function toForm(profile: Profile): FormValues {
  return {
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? '',
    preferredLocale: profile.preferredLocale,
  };
}

export function ProfilePage() {
  const { session, gateway } = useAuth();
  const user = session?.user;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!user) return;

    void gateway
      .fetchProfile(user.id)
      .then((next) => {
        if (!active) return;
        setProfile(next);
        if (next) {
          setValues(toForm(next));
          setLoadState('ready');
        } else {
          // No row yet: let the person start from a sensible default.
          setValues({ ...EMPTY_FORM, displayName: user.email?.split('@')[0] ?? '' });
          setLoadState('missing');
        }
      })
      .catch(() => {
        if (active) setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [gateway, user, reloadKey]);

  function retry() {
    setLoadState('loading');
    setReloadKey((key) => key + 1);
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setFormError(null);
    setSaved(false);

    const parsed = profileUpdateSchema.safeParse({
      displayName: values.displayName,
      avatarUrl: values.avatarUrl || undefined,
      preferredLocale: values.preferredLocale,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'displayName' || key === 'avatarUrl' || key === 'preferredLocale') {
          next[key] ??= issue.message;
        }
      }
      setErrors(next);
      return;
    }

    setSaving(true);
    try {
      // Only editable fields are sent. The user id comes from the verified
      // session, never from a form input.
      const next = await gateway.updateProfile(user.id, {
        displayName: parsed.data.displayName,
        avatarUrl: parsed.data.avatarUrl ?? '',
        preferredLocale: parsed.data.preferredLocale,
      });
      setProfile(next);
      setValues(toForm(next));
      setLoadState('ready');
      setSaved(true);
    } catch (error) {
      setFormError(messageForAuthError(error));
    } finally {
      setSaving(false);
    }
  }

  const verified = Boolean(user?.emailConfirmedAt);
  const { locale, currency } = useLocale();

  return (
    <AccountShell title={AUTH_COPY.profile.title} description={AUTH_COPY.profile.subtitle}>
      {verified ? null : (
        <Alert tone="warning" className="mb-4">
          {AUTH_COPY.profile.unverifiedNotice}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editable details</CardTitle>
            <CardDescription>{AUTH_COPY.profile.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadState === 'loading' ? (
              <div className="space-y-3" role="status" aria-live="polite">
                <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
                <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
                <div className="h-10 w-1/2 animate-pulse rounded-lg bg-surface-muted" />
                <span className="sr-only">Loading your profile</span>
              </div>
            ) : loadState === 'error' || loadState === 'missing' ? (
              <div className="space-y-3">
                <Alert tone={loadState === 'error' ? 'danger' : 'info'}>
                  {loadState === 'error'
                    ? AUTH_COPY.profile.loadFailed
                    : 'Your profile row is not available yet. It is created automatically after the email address is confirmed.'}
                </Alert>
                <Button variant="outline" size="sm" onClick={retry}>
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                {formError ? <Alert tone="danger">{formError}</Alert> : null}
                {saved ? <Alert tone="success">{AUTH_COPY.profile.saved}</Alert> : null}

                <Field
                  label={AUTH_COPY.profile.displayName}
                  htmlFor="displayName"
                  hint={AUTH_COPY.profile.displayNameHint}
                  error={errors.displayName}
                  required
                >
                  <Input
                    id="displayName"
                    name="displayName"
                    value={values.displayName}
                    onChange={(event) => update('displayName', event.target.value)}
                    disabled={saving}
                    aria-invalid={errors.displayName ? true : undefined}
                    aria-describedby={errors.displayName ? 'displayName-error' : 'displayName-hint'}
                  />
                </Field>

                <Field
                  label={AUTH_COPY.profile.avatarUrl}
                  htmlFor="avatarUrl"
                  hint={AUTH_COPY.profile.avatarUrlHint}
                  error={errors.avatarUrl}
                >
                  <Input
                    id="avatarUrl"
                    name="avatarUrl"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={values.avatarUrl}
                    onChange={(event) => update('avatarUrl', event.target.value)}
                    disabled={saving}
                    aria-invalid={errors.avatarUrl ? true : undefined}
                    aria-describedby={errors.avatarUrl ? 'avatarUrl-error' : 'avatarUrl-hint'}
                  />
                </Field>

                <div className="space-y-1.5">
                  <Label htmlFor="preferredLocale">{AUTH_COPY.profile.language}</Label>
                  <select
                    id="preferredLocale"
                    name="preferredLocale"
                    value={values.preferredLocale}
                    onChange={(event) => update('preferredLocale', event.target.value)}
                    disabled={saving}
                    aria-invalid={errors.preferredLocale ? true : undefined}
                    className="flex h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-ink transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35"
                  >
                    {SUPPORTED_LOCALES.map((locale) => (
                      <option key={locale} value={locale}>
                        {LOCALES[locale].label}
                      </option>
                    ))}
                  </select>
                  {errors.preferredLocale ? (
                    <p role="alert" className="text-xs font-medium text-danger">
                      {errors.preferredLocale}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button type="submit" loading={saving}>
                    {saving ? AUTH_COPY.profile.saving : AUTH_COPY.profile.save}
                  </Button>
                  {profile ? (
                    <span className="text-[11px] text-ink-subtle">
                      {AUTH_COPY.profile.updatedAtLabel}: {formatDate(profile.updatedAt)}
                    </span>
                  ) : null}
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{AUTH_COPY.profile.readOnlyTitle}</CardTitle>
            <CardDescription>{AUTH_COPY.profile.readOnlyBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {verified ? (
                <Badge tone="success">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  {AUTH_COPY.dashboard.verified}
                </Badge>
              ) : (
                <Badge tone="warning">
                  <MailWarning className="size-3.5" aria-hidden="true" />
                  {AUTH_COPY.dashboard.unverified}
                </Badge>
              )}
            </div>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                  {AUTH_COPY.profile.emailLabel}
                </dt>
                <dd className="break-all text-ink-muted">{user?.email ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                  {AUTH_COPY.profile.userIdLabel}
                </dt>
                <dd className="break-all font-mono text-xs text-ink-muted">{user?.id}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                  {AUTH_COPY.profile.createdAtLabel}
                </dt>
                <dd className="text-ink-muted">
                  {profile?.createdAt
                    ? formatDate(profile.createdAt)
                    : (user?.createdAt ?? 'Unknown')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regional format</CardTitle>
            <CardDescription>
              How numbers and dates appear for you. Change these from the language and currency menu
              in the header.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Display currency</span>
              <span className="font-medium text-ink">{currency}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Sample amount</span>
              <span className="font-medium tabular-nums text-ink">
                {formatMoney({ amountMinor: 1_234_567, currency, locale: intlLocaleFor(locale) })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Sample date</span>
              <span className="font-medium text-ink">
                {formatDate('2026-01-01T09:00:00.000Z', { locale: intlLocaleFor(locale) })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
