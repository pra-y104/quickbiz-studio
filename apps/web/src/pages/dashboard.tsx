import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  BadgeCheck,
  CalendarDays,
  Clapperboard,
  FileText,
  IdCard,
  LayoutGrid,
  MailWarning,
  Share2,
  Sparkles,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { Profile } from '@quickbiz/shared';
import { AUTH_COPY } from '../content/auth';
import { Alert } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AccountShell } from '../components/account/account-shell';
import { useAuth } from '../lib/auth/auth-context';
import { messageForAuthError } from '../lib/auth/messages';
import { emailCallbackUrl } from '../lib/auth/urls';
import { formatDate } from '@quickbiz/shared';

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDate(date.toISOString());
}

/**
 * Workspace shortcuts. Every target is a real route in the app router; nothing
 * here links to an unbuilt page. AI/free tools both live under the tools
 * directory, which already separates them.
 */
const WORKSPACE_LINKS = [
  { to: '/tools', label: 'All tools', hint: 'Free utilities and AI tools', icon: LayoutGrid },
  { to: '/tools', label: 'AI writing tools', hint: 'Draft, translate, polish', icon: Sparkles },
  {
    to: '/studio',
    label: 'Creative Studio',
    hint: 'Design projects and templates',
    icon: FileText,
  },
  { to: '/studio/video', label: 'Video Studio', hint: 'Video projects', icon: Clapperboard },
  { to: '/wallet', label: 'Wallet and credits', hint: 'Balance and transactions', icon: Wallet },
  { to: '/referral', label: 'Referrals', hint: 'Invite and earn', icon: Share2 },
  { to: '/profile', label: 'Profile and settings', hint: 'Your account details', icon: UserRound },
] as const;

export function DashboardPage() {
  const { session, gateway } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const user = session?.user;
  const verified = Boolean(user?.emailConfirmedAt);

  useEffect(() => {
    let active = true;
    if (!user) return;

    void gateway
      .fetchProfile(user.id)
      .then((next) => {
        if (active) setProfile(next);
      })
      .catch(() => {
        // A missing profile row must not block the dashboard; the account still
        // works and the profile screen can retry the read.
      });

    return () => {
      active = false;
    };
  }, [gateway, user]);

  async function resendVerification() {
    if (!user?.email) return;
    setResending(true);
    setResent(false);
    setResendError(null);
    try {
      await gateway.resendVerification({
        email: user.email,
        emailRedirectTo: emailCallbackUrl(),
      });
      setResent(true);
    } catch (error) {
      setResendError(messageForAuthError(error));
    } finally {
      setResending(false);
    }
  }

  const displayName = profile?.displayName || user?.email || 'there';
  const memberSince = formatTimestamp(profile?.createdAt ?? user?.createdAt ?? null);

  return (
    <AccountShell
      title={AUTH_COPY.dashboard.title}
      description={`${AUTH_COPY.dashboard.welcome}, ${displayName}.`}
    >
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3 p-5 pb-3">
              <div className="space-y-1.5">
                <CardTitle className="text-base">Email status</CardTitle>
                <CardDescription>
                  {verified ? AUTH_COPY.dashboard.verified : AUTH_COPY.dashboard.unverifiedBody}
                </CardDescription>
              </div>
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
            {verified ? null : (
              <CardContent className="space-y-3">
                {resent ? <Alert tone="info">{AUTH_COPY.verify.resent}</Alert> : null}
                {resendError ? <Alert tone="danger">{resendError}</Alert> : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={resendVerification} loading={resending}>
                    {AUTH_COPY.dashboard.resend}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/verify-email">Verification help</Link>
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card as="section" aria-label={AUTH_COPY.dashboard.workspaceTitle}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutGrid className="size-4 text-primary" aria-hidden="true" />
                {AUTH_COPY.dashboard.workspaceTitle}
              </CardTitle>
              <CardDescription>{AUTH_COPY.dashboard.workspaceBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {WORKSPACE_LINKS.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="group flex items-start gap-3 rounded-card border border-border bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-elev-1"
                    >
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <item.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{item.label}</span>
                        <span className="block text-xs text-ink-subtle">{item.hint}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{AUTH_COPY.dashboard.accountDetails}</CardTitle>
            <CardDescription>Read-only values from authentication.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <IdCard className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                    {AUTH_COPY.profile.emailLabel}
                  </dt>
                  <dd className="truncate text-ink-muted">{user?.email ?? 'Not available'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <IdCard className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                    {AUTH_COPY.dashboard.userId}
                  </dt>
                  <dd className="break-all font-mono text-xs text-ink-muted">{user?.id}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays
                  className="mt-0.5 size-4 shrink-0 text-ink-subtle"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                    {AUTH_COPY.dashboard.memberSince}
                  </dt>
                  <dd className="text-ink-muted">{memberSince ?? 'Unknown'}</dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
