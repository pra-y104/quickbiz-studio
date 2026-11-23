import { Check, Globe } from 'lucide-react';
import { CURRENCIES, LOCALES, PLANNED_LOCALES } from '@quickbiz/shared';
import { cn } from '../../lib/cn';
import { enabledCurrencies } from '../../lib/locale/preferences';
import { useLocale } from '../../lib/locale/locale-provider';

/**
 * Language and currency display menu.
 *
 * Languages with a complete catalogue are selectable; planned languages are
 * listed but disabled and labelled "Soon" so the interface never pretends a
 * translation exists. The currency choice is a display preference only — no live
 * exchange rate is applied and no wallet balance changes.
 */
export function LocaleMenu({ className }: { readonly className?: string }) {
  const { locale, currency, setLocale, setCurrency } = useLocale();

  const activeLanguage =
    LOCALES[locale as keyof typeof LOCALES]?.label ??
    PLANNED_LOCALES.find((entry) => entry.code === locale)?.label ??
    'English';

  return (
    <details className={cn('group relative', className)}>
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink [&::-webkit-details-marker]:hidden"
        aria-label="Language and currency"
      >
        <Globe className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{activeLanguage}</span>
        <span className="text-xs text-ink-subtle">{currency}</span>
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-64 rounded-card border border-border bg-surface p-3 shadow-elev-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Language
        </h2>
        <ul className="mt-1 space-y-0.5">
          {Object.values(LOCALES).map((entry) => (
            <li key={entry.code}>
              <button
                type="button"
                onClick={() => setLocale(entry.code)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
              >
                {entry.label}
                {locale === entry.code ? (
                  <Check className="size-4 text-primary" aria-hidden="true" />
                ) : null}
              </button>
            </li>
          ))}
          {PLANNED_LOCALES.map((entry) => (
            <li key={entry.code}>
              <button
                type="button"
                disabled
                title="Coming soon"
                className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-ink-subtle"
              >
                {entry.label}
                <span className="text-[10px] uppercase tracking-wide">Soon</span>
              </button>
            </li>
          ))}
        </ul>

        <h2 className="mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Display currency
        </h2>
        <ul className="mt-1 grid grid-cols-2 gap-0.5">
          {enabledCurrencies().map((code) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => setCurrency(code)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm',
                  currency === code
                    ? 'bg-primary-soft text-primary'
                    : 'text-ink hover:bg-surface-muted',
                )}
              >
                {code}
                {currency === code ? <Check className="size-3.5" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-subtle">
          Display preference only. {CURRENCIES[currency]?.name ?? currency} · no live exchange rate.
        </p>
      </div>
    </details>
  );
}
