/* eslint-disable react-refresh/only-export-components -- the provider and its hook are
   intentionally co-located; Fast Refresh is not used for this context module. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CurrencyCode } from '@quickbiz/shared';
import i18n from '../../i18n';
import {
  DEFAULT_LOCALE,
  readStoredCurrency,
  readStoredLocale,
  storeCurrency,
  storeLocale,
} from './preferences';

export interface LocaleContextValue {
  /** Active display locale code (e.g. 'en'). */
  readonly locale: string;
  /** Active display currency (never a live rate). */
  readonly currency: CurrencyCode;
  setLocale(locale: string): void;
  setCurrency(currency: CurrencyCode): void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(() => readStoredLocale() || DEFAULT_LOCALE);
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => readStoredCurrency());

  // Keep the i18n runtime in step with the stored preference.
  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale]);

  const setLocale = useCallback((next: string) => {
    setLocaleState(next);
    storeLocale(next);
    void i18n.changeLanguage(next);
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCurrencyState(next);
    storeCurrency(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, currency, setLocale, setCurrency }),
    [locale, currency, setLocale, setCurrency],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Read the display preferences, throwing if used outside the provider. */
export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return context;
}
