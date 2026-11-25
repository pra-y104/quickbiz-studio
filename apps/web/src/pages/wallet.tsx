/* eslint-disable react-hooks/set-state-in-effect -- the wallet loads from Supabase on mount and
   settles asynchronously; the empty-state assignment only reflects an already-known auth status. */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw, Wallet as WalletIcon } from 'lucide-react';
import { formatMoney, type CurrencyCode } from '@quickbiz/shared';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Container } from '../components/ui/container';
import { Alert } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { AccountShell } from '../components/account/account-shell';
import { useAuth } from '../lib/auth/auth-context';
import { fetchWallet, WalletUnavailableError, type WalletView } from '../lib/wallet/client';
import {
  createCheckout,
  paymentStatus,
  refundPayment,
  type CheckoutRequest,
  type RefundResult,
} from '../lib/payments/client';

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

/** Credit packs offered for purchase. Prices are integer minor units (kobo for NGN). */
const CREDIT_PACKS: ReadonlyArray<{
  readonly label: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly credits: number;
  readonly featured?: boolean;
}> = [
  { label: '₦1,000', amountMinor: 100000, currency: 'NGN', credits: 10 },
  { label: '₦2,500', amountMinor: 250000, currency: 'NGN', credits: 25, featured: true },
  { label: '₦5,000', amountMinor: 500000, currency: 'NGN', credits: 50 },
  { label: '₦10,000', amountMinor: 1_000_000, currency: 'NGN', credits: 100 },
];

export function WalletPage() {
  const { session, status, gateway } = useAuth();
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<{
    readonly configured: boolean;
    readonly provider: string | null;
    readonly mode: string | null;
    readonly ledgerConfigured: boolean;
  } | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [refunding, setRefunding] = useState(false);
  const [refundResult, setRefundResult] = useState<RefundResult | null>(null);
  const [selectedPack, setSelectedPack] = useState<{
    readonly label: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly credits: number;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

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

  const loadPayments = async (): Promise<void> => {
    try {
      setPayments(await paymentStatus());
    } catch {
      setPayments(null);
    }
  };

  useEffect(() => {
    if (status === 'ready' && session) {
      void load();
      void loadPayments();
    }
    if (status === 'ready' && !session) setState('empty');
  }, [status, session]);

  if (status === 'loading' || state === 'loading') {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6 text-primary" label="Loading your wallet" />
      </Container>
    );
  }

  const purchaseCredit = async (pack: {
    readonly label: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly credits: number;
  }): Promise<void> => {
    if (!session) return;
    const accessToken = await gateway.getAccessToken();
    if (!accessToken) {
      setPurchaseError({
        code: 'UNAUTHORIZED',
        message: 'Sign in to purchase credits.',
      });
      return;
    }

    abortRef.current = new AbortController();
    setPurchasing(true);
    setPurchaseError(null);
    setSelectedPack(pack);

    try {
      const request: CheckoutRequest = {
        amountMinor: pack.amountMinor,
        currency: pack.currency,
        email: session.user?.email ?? '',
        callbackUrl: `${window.location.origin}/wallet`,
      };
      const session_ = await createCheckout(request, accessToken);
      // Send the customer to the provider's checkout page. The provider redirects
      // back to this origin after payment; we then verify on this page.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = session_.authorizationUrl;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Could not start checkout. Try again.';
      setPurchaseError({ code: 'UNKNOWN', message });
    } finally {
      setPurchasing(false);
    }
  };

  const handleRefund = async (): Promise<void> => {
    if (!session) return;
    const accessToken = await gateway.getAccessToken();
    if (!accessToken) {
      setPurchaseError({
        code: 'UNAUTHORIZED',
        message: 'Sign in to request a refund.',
      });
      return;
    }

    const reference = window.prompt('Enter the payment reference to refund:');
    if (!reference) return;

    const amountMinor = window.prompt('Refund amount (minor units, e.g. 100000 for ₦1,000):');
    if (!amountMinor) return;

    setRefunding(true);
    try {
      const result = await refundPayment(
        { reference, amountMinor: Number(amountMinor) },
        accessToken,
      );
      setRefundResult(result);
    } catch (caught) {
      setPurchaseError({
        code: 'UNKNOWN',
        message: caught instanceof Error ? caught.message : 'Could not process the refund.',
      });
    } finally {
      setRefunding(false);
    }
  };

  return (
    <AccountShell
      title="Your wallet"
      description="Top up to use paid AI tools. Balances are held in the currency shown and only change after a verified payment or a completed run."
    >
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mb-4"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to dashboard
      </Link>

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
        <div className="space-y-6">
          {/* Balance card */}
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

          {/* Payments status banner */}
          {payments ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-primary-soft">
                    {payments.configured ? (
                      <WalletIcon className="size-4" />
                    ) : (
                      <span className="size-4">—</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                      Payment provider
                    </p>
                    <p className="text-sm font-medium text-ink">
                      {payments.configured ? payments.provider : 'Not configured'}
                    </p>
                    <p className="text-xs text-ink-muted mt-1">
                      {payments.configured
                        ? `Mode: ${payments.mode}. Settlement: ${
                            payments.ledgerConfigured ? 'configured' : 'pending migration'
                          }.`
                        : 'Connect a Paystack test-mode key (PAYSTACK_SECRET_KEY starting with sk_test_) to enable credit purchases.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Credit purchase */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add credit</CardTitle>
            </CardHeader>
            <CardContent>
              {payments?.configured && payments?.ledgerConfigured ? (
                <>
                  <p className="text-sm text-ink-muted mb-4">
                    Choose how much credit to add. You will be sent to Paystack (test mode) to
                    complete the payment, then return here to confirm.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {CREDIT_PACKS.map((pack) => {
                      const isSelected =
                        selectedPack &&
                        selectedPack.amountMinor === pack.amountMinor &&
                        selectedPack.currency === pack.currency;
                      return (
                        <Button
                          key={pack.label}
                          type="button"
                          variant={isSelected ? 'primary' : 'outline'}
                          disabled={purchasing}
                          onClick={() => purchaseCredit(pack)}
                          className="flex flex-col items-center gap-2 min-h-[96px] px-4 py-3"
                        >
                          <div className="text-sm font-medium text-ink">{pack.label}</div>
                          <div className="text-xs text-ink-subtle">{pack.credits} credits</div>
                          {pack.featured && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-success bg-success-soft px-1.5 py-0.5 rounded">
                              Popular
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  {selectedPack && !purchasing && (
                    <div className="mt-4">
                      <Button
                        type="button"
                        variant="primary"
                        disabled={purchasing}
                        onClick={() => purchaseCredit(selectedPack)}
                        className="w-full"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        {purchasing ? 'Starting checkout…' : `Buy ${selectedPack.label} pack`}
                      </Button>
                    </div>
                  )}
                  {purchaseError ? (
                    <Alert tone="danger" className="mt-4" title="Checkout could not start">
                      {purchaseError.message}
                    </Alert>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <p className="text-sm text-ink-muted">Credit purchases are not available yet.</p>
                  <p className="text-xs text-ink-subtle">
                    A Paystack test-mode key and the payment migration must be applied before
                    balances can change.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction history */}
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

          {/* Refund tool (admin/customer support) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request a refund</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-muted mb-4">
                If a paid AI generation failed and you were still charged, use your payment
                reference to request a refund. Refunds are processed by Paystack and may take time
                to appear.
              </p>
              {refundResult ? (
                <Alert tone="success" title="Refund requested">
                  Reference {refundResult.reference}: {refundResult.amountMinor} minor units, status{' '}
                  {refundResult.status}.
                </Alert>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={refunding}
                onClick={handleRefund}
              >
                {refunding ? 'Processing…' : 'Start refund'}
              </Button>
              {purchaseError && !purchasing ? (
                <Alert tone="danger" className="mt-4" title="Refund failed">
                  {purchaseError.message}
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Alert tone="info" title="Nothing is stored on a server">
            This wallet exists only while you are signed in. Balances and transaction history are
            read from your Supabase-backed account; credit purchases go through Paystack in test
            mode and are never live charges unless you explicitly approve them.
          </Alert>
        </div>
      )}
    </AccountShell>
  );
}

export default WalletPage;
