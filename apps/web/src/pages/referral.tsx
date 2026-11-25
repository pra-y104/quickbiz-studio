/**
 * Referral dashboard.
 *
 * Generates a unique referral link from the signed-in user's ID, lets the
 * customer copy it and share it over WhatsApp or social channels, and shows a
 * client-side record of referrals saved in this browser.
 *
 * Honest limitations (stated in the UI):
 *  * Referral tracking is local to this browser until a backend referral
 *    service exists. It is not a source of truth for rewards.
 *  * Self-referral is blocked: a customer cannot use their own link.
 *  * Duplicate accounts from the same device/browser are detectable only
 *    heuristically (same referral code used twice from one storage).
 *
 * No rewards are paid out in this build. The dashboard exists so customers can
 * start sharing and so the referral UI is ready when the backend is wired.
 */

import { useCallback, useEffect, useState } from 'react';
import { Copy, Mail, Share2 } from 'lucide-react';
import { BRAND } from '@quickbiz/shared';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert } from '../components/ui/alert';
import { AccountShell } from '../components/account/account-shell';
import { useAuth } from '../lib/auth/auth-context';

const REFERRAL_STORAGE_KEY = 'quickbiz-referrals';

interface ReferralRecord {
  readonly id: string;
  readonly code: string;
  readonly referredAt: string;
  readonly status: 'pending' | 'qualified' | 'rejected';
}

/** Build a referral URL from the current origin and the user's ID. */
function referralUrl(userId: string): string {
  const base = window.location.origin.replace(/\/+$/, '');
  return `${base}/r/${encodeURIComponent(userId)}`;
}

function loadAllReferrals(): readonly ReferralRecord[] {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReferralRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadReferrals(code: string): readonly ReferralRecord[] {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReferralRecord[];
    return Array.isArray(parsed) ? parsed.filter((r) => r.code === code) : [];
  } catch {
    return [];
  }
}

function saveReferral(record: ReferralRecord): void {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    const existing: ReferralRecord[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(existing)) return;
    const next = [...existing, record].slice(-200);
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be blocked or full; referrals live only in this tab.
  }
}

/** A referral using one's own ID is never valid. */
function isSelfReferral(code: string, userId: string): boolean {
  return code === userId;
}

export function ReferralDashboardPage() {
  const { session } = useAuth();
  const user = session?.user;
  const code = user?.id ?? '';
  const url = code ? referralUrl(code) : '';
  const [copied, setCopied] = useState(false);
  const [enteringCode, setEnteringCode] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [referralMessage, setReferralMessage] = useState<{
    tone: 'success' | 'warning' | 'danger';
    title: string;
    body: string;
  } | null>(null);
  const [referrals, setReferrals] = useState<readonly ReferralRecord[]>([]);
  // Refresh the referral list whenever the signed-in user changes (auth loads
  // asynchronously, so code may be empty on the first render). This synchronises
  // derived state from a context change, which is the intended use of setState in
  // an effect per React's docs.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReferrals(code ? loadReferrals(code) : []);
  }, [code]);
  const qualifiedCount = referrals.filter((r) => r.status === 'qualified').length;
  const pendingCount = referrals.filter((r) => r.status === 'pending').length;

  const copyLink = useCallback(async (): Promise<void> => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be blocked; fall back to selecting the input.
    }
  }, [url]);

  const shareWhatsApp = useCallback((): void => {
    if (!url) return;
    const text = encodeURIComponent(`Join me on ${BRAND.name} using my referral link: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }, [url]);

  const shareSocial = useCallback((): void => {
    if (!navigator.share || !url) return;
    void navigator.share({
      title: BRAND.name,
      text: 'Join me on QuickBiz Studio using my referral link.',
      url,
    });
  }, [url]);

  const handleEnterReferralCode = useCallback(async (): Promise<void> => {
    if (!enteredCode.trim()) {
      setReferralMessage({
        tone: 'warning',
        title: 'Enter a code',
        body: 'Paste the referral code you received.',
      });
      return;
    }
    // Fraud protection: self-referral is blocked.
    if (isSelfReferral(enteredCode, code)) {
      setReferralMessage({
        tone: 'danger',
        title: 'Self-referral blocked',
        body: 'You cannot use your own referral code.',
      });
      return;
    }
    // Duplicate detection: the same code already recorded from this browser.
    const existing = loadAllReferrals().some((r) => r.code === enteredCode);
    if (existing) {
      setReferralMessage({
        tone: 'warning',
        title: 'Already recorded',
        body: 'That referral code is already recorded in this browser.',
      });
      return;
    }
    saveReferral({
      id: `ref-${Date.now()}`,
      code: enteredCode,
      referredAt: new Date().toISOString(),
      status: 'pending',
    });
    setReferrals(loadReferrals(code));
    setReferralMessage({
      tone: 'success',
      title: 'Referral recorded',
      body: 'This referral is pending. It qualifies when the referred customer completes their first paid purchase.',
    });
    setEnteredCode('');
    setEnteringCode(false);
  }, [code, enteredCode]);

  if (!user) {
    return (
      <AccountShell title="Referrals" description="Sign in to get your referral link.">
        <Alert tone="info">Sign in to see your unique referral link and start referring.</Alert>
      </AccountShell>
    );
  }

  return (
    <AccountShell
      title="Refer a friend"
      description="Share your unique link. When someone signs up with it, their first credit purchase qualifies you for a referral reward (rewards are not active in this build)."
    >
      <div className="space-y-6">
        {/* Referral link card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your referral link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <InputWithCopy value={url} onCopy={copyLink} copied={copied} />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={shareWhatsApp}
                disabled={!url}
              >
                <Mail className="size-3.5" aria-hidden="true" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={shareSocial}
                disabled={!url || !navigator.share}
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                Share
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Send this link to a business owner. They sign up, verify their email, and make their
              first credit purchase — that is a qualifying referral.
            </p>
            <Alert tone="info" className="mt-3" title="How referrals work">
              <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted mt-1">
                <li>
                  Copy your link and share it. Do not use your own link — self-referrals are
                  blocked.
                </li>
                <li>
                  A referral qualifies when the new customer completes their first paid credit
                  purchase. Rewards are not paid out in this build.
                </li>
                <li>
                  Referrals are recorded in this browser only. Clear your site data and the record
                  is gone. A backend referral service is required for payouts.
                </li>
              </ul>
            </Alert>
          </CardContent>
        </Card>

        {/* Enter a referral code (you were referred by someone) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Were you referred?</CardTitle>
          </CardHeader>
          <CardContent>
            {referralMessage ? (
              <Alert tone={referralMessage.tone} className="mb-3" title={referralMessage.title}>
                {referralMessage.body}
              </Alert>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={enteredCode}
                onChange={(event) => setEnteredCode(event.target.value)}
                placeholder="Paste referral code"
                className="flex-1 min-w-0 text-sm border border-border rounded-lg bg-surface text-ink placeholder-ink-subtle focus:ring-2 focus:ring-focus/70 focus:ring-offset-0"
                disabled={enteringCode}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={enteringCode || !enteredCode.trim()}
                onClick={handleEnterReferralCode}
              >
                {enteringCode ? 'Recording…' : 'Record referral'}
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              If a friend sent you their link, paste their referral code here. Self-referrals and
              duplicates from this browser are blocked.
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Total referred
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                  {referrals.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Pending
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-muted">
                  {pendingCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Qualified (reward eligible)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-success">
                  {qualifiedCount}
                </p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Recent referrals */}
        {referrals.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border space-y-3">
                {referrals
                  .slice()
                  .sort((a, b) => b.referredAt.localeCompare(a.referredAt))
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">
                          Referred {entry.code.slice(-6)}…
                        </p>
                        <p className="text-xs text-ink-subtle">
                          {new Date(entry.referredAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.status === 'qualified'
                            ? 'bg-success-soft text-success'
                            : entry.status === 'pending'
                              ? 'bg-warning-soft text-warning'
                              : 'bg-danger-soft text-danger'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-ink-muted">No referrals yet.</p>
              <p className="text-xs text-ink-subtle mt-1">
                Share your link above to start referring.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountShell>
  );
}

/**
 * Small input with a copy button. Extracted so it can be reused wherever a
 * referral link is shown.
 */
function InputWithCopy({
  value,
  onCopy,
  copied,
}: {
  readonly value: string;
  readonly onCopy: () => void;
  readonly copied: boolean;
}) {
  return (
    <div className="relative flex w-full">
      <input
        readOnly
        value={value}
        className="flex-1 min-w-0 pl-3 pr-10 text-sm border border-border rounded-lg bg-surface text-ink placeholder-ink-subtle focus:ring-2 focus:ring-focus/70 focus:ring-offset-0 sm:text-base"
        aria-label="Referral link"
        spellCheck="false"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2"
        onClick={onCopy}
        aria-label={copied ? 'Copied' : 'Copy referral link'}
      >
        <Copy className="size-3.5" aria-hidden="true" />
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export default ReferralDashboardPage;
