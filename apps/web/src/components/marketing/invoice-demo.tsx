import { useTranslation } from 'react-i18next';
import { ArrowRight, Receipt } from 'lucide-react';
import { Link } from 'react-router';
import { computeDocumentTotals, formatMoney, type DocumentLine } from '@quickbiz/shared';

/**
 * Live product demonstration.
 *
 * This is not a mock-up or a video: the totals below are computed by
 * `computeDocumentTotals`, the same function the invoice maker uses, from the same
 * sample lines. Change the shared function and this card changes with it.
 *
 * It deliberately shows the free, working side of the product rather than a
 * simulation of AI output.
 */

const SAMPLE_LINES: readonly DocumentLine[] = [
  { id: 'l1', description: 'Brand strategy session', quantity: 1, unitPriceMinor: 3_500_000 },
  { id: 'l2', description: 'Social media templates', quantity: 3, unitPriceMinor: 1_200_000 },
  { id: 'l3', description: 'Logo refinement', quantity: 1, unitPriceMinor: 1_800_000 },
];

const SAMPLE = {
  lines: SAMPLE_LINES,
  discountType: 'none' as const,
  discountValue: 0,
  taxPercent: 7.5,
  shippingMinor: 0,
};

const TOTALS = computeDocumentTotals(SAMPLE);

function money(minor: number): string {
  return formatMoney({ amountMinor: minor, currency: 'NGN' });
}

export function InvoiceDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white p-5 text-left shadow-elev-3 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            <Receipt className="size-3.5" aria-hidden="true" />
            {t('home.demo.label')}
          </p>
          <p className="mt-1 text-base font-semibold text-ink">INV-2026-0142</p>
        </div>
        <span className="rounded-pill bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
          {t('home.demo.paid')}
        </span>
      </div>

      <dl className="mt-4 space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-subtle">{t('home.demo.billedTo')}</dt>
          <dd className="font-medium text-ink">Zola Print &amp; Design</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-subtle">{t('home.demo.issued')}</dt>
          <dd className="font-medium text-ink">12 Feb 2026</dd>
        </div>
      </dl>

      <ul className="mt-4 divide-y divide-border border-y border-border">
        {SAMPLE_LINES.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
            <span className="min-w-0 text-ink">
              {line.description}
              {line.quantity > 1 ? (
                <span className="ml-1 text-xs text-ink-subtle">×{line.quantity}</span>
              ) : null}
            </span>
            <span className="shrink-0 font-medium text-ink">
              {money(Math.round(line.quantity * line.unitPriceMinor))}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-ink-muted">{t('home.demo.subtotal')}</dt>
          <dd className="text-ink">{money(TOTALS.subtotalMinor)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">{t('home.demo.tax')}</dt>
          <dd className="text-ink">{money(TOTALS.taxMinor)}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-border pt-2">
          <dt className="text-sm font-semibold text-ink">{t('home.demo.total')}</dt>
          <dd className="text-base font-semibold text-ink">{money(TOTALS.totalMinor)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-subtle">{t('home.demo.note')}</p>

      <ButtonLink />
    </div>
  );
}

function ButtonLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/tools/invoice-maker"
      className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {t('home.demo.cta')}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}
