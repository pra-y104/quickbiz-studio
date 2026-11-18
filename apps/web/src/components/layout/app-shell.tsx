import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

function SkipLink() {
  const { t } = useTranslation();
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-elev-2"
    >
      {t('nav.skipToContent')}
    </a>
  );
}

/** Shared chrome for every page: skip link, marketing header, footer. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
