/* eslint-disable react-hooks/set-state-in-effect -- the wallet loads from Supabase on mount and
   settles asynchronously; the empty-state assignment only reflects an already-known auth status. */
import { useEffect, useState } from 'react';
import { RefreshCw, Wallet as WalletIcon } from 'lucide-react';
import { formatMoney, type CurrencyCode } from '@quickbiz/shared';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Container } from '../components/ui/container';
import { Alert } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { AccountShell } from '../components/account/account-shell';
import { useAuth } from '../lib/auth/auth-context';
import { fetchWallet, WalletUnavailableError, type WalletView } from '../lib/wallet/client';

const KIND_LABEL: Record<string, string> = {
  credit: 'Top-up',
  debit: 'Spend',
  reserve: 'Hold',
  release: 'Released',
  refund: 'Refund',
};

function formatAmount(amountMinor: number, currency: string): string {
  try {
    return formatMoney({ amountMinor, currency: currency as CurrencyCode, locale: 'en' });
  } catch {
    return `${amountMinor} ${currency}`;
  }
}

export function WalletPage() {
  const { session, status } = useAuth();
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    setState('loading');
    setError(null);
    try {
      const result = await fetchWallet();
      setWallet(result);
      setState(result ? 'ready' : 'empty');
    } catch (caught) {
      setError(
        caught instanceof WalletUnavailableError ? caught.message : 'Could not load your wallet.',
      );
      setState('error');
    }
  };

  useEffect(() => {
    if (status === 'ready' && session) void load();
    if (status === 'ready' && !session) setState('empty');
  }, [status, session]);

  if (status === 'loading' || state === 'loading') {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6 text-primary" label="Loading your wallet" />
      </Container>
    );
  }

  return (
    <AccountShell
      title="Your wallet"
      description="Top up to use paid AI tools. Balances are held in the currency shown and only change after a verified payment or a completed run."
    >
      {state === 'error' ? (
        <Alert tone="warning">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </Alert>
      ) : state === 'empty' || !wallet ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div
              className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
              aria-hidden="true"
            >
              <WalletIcon className="size-6" />
            </div>
            <h2 className="text-base font-semibold text-ink">No wallet yet</h2>
            <p className="max-w-sm text-sm text-ink-muted">
              A wallet is created the first time you add credit. Paid AI tools are not available in
              this build, so there is nothing to spend on yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end justify-between gap-4 p-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Balance
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">
                  {formatAmount(wallet.balanceMinor, wallet.currency)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Available to spend: {formatAmount(wallet.availableMinor, wallet.currency)}
                </p>
              </div>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink">
                {wallet.currency}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transaction history</CardTitle>
            </CardHeader>
            <CardContent>
              {wallet.entries.length === 0 ? (
                <p className="text-sm text-ink-muted">No transactions yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {wallet.entries.map((entry) => {
                    const isCredit = entry.kind === 'credit' || entry.kind === 'refund';
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-4 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink">
                            {KIND_LABEL[entry.kind] ?? entry.kind}
                          </p>
                          <p className="truncate text-xs text-ink-subtle">
                            {new Date(entry.createdAt).toLocaleString()}
                            {entry.reference ? ` · ${entry.reference}` : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 tabular-nums ${isCredit ? 'text-success' : 'text-ink'}`}
                        >
                          {isCredit ? '+' : '−'}
                          {formatAmount(entry.amountMinor, entry.currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AccountShell>
  );
}

export default WalletPage;
