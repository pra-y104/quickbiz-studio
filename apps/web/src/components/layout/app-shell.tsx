import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { APP_TAGLINE } from '@quickbiz/shared';
import { Logo } from '../brand/logo';
import { Badge } from '../ui/badge';
import { Container } from '../ui/container';
import { ThemeToggle } from '../ui/theme-toggle';

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

function SiteHeader() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link
          to="/"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <Badge tone="brand" className="hidden sm:inline-flex">
            Stage 2
          </Badge>
          <Link
            to="/design-system"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink sm:inline-flex"
          >
            {t('nav.designSystem')}
          </Link>
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}

function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getUTCFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-ink-muted">{APP_TAGLINE}</p>
        </div>
        <div className="space-y-2 text-sm text-ink-muted sm:text-right">
          <Badge tone="neutral">{t('footer.build')}</Badge>
          <p>
            &copy; {year} QuickBiz Studio. {t('footer.rights')}
          </p>
          <p className="text-xs text-ink-subtle">
            Built with React, TypeScript and Cloudflare Workers.
          </p>
        </div>
      </Container>
    </footer>
  );
}

/** Marketing/app chrome used by every page until dedicated shells arrive. */
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
