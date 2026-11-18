import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { BRAND } from '@quickbiz/shared';
import { Logo } from '../brand/logo';
import { Container } from '../ui/container';
import { ThemeToggle } from '../ui/theme-toggle';

/**
 * Chrome for secondary pages (design system, 404).
 *
 * It intentionally omits the marketing section navigation: those links point at
 * sections that only exist on the homepage, and a dead anchor is worse than no
 * link at all.
 */
export function UtilityShell({ children }: { children: ReactNode }) {
  const year = new Date().getUTCFullYear();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between gap-3">
          <Link
            to="/"
            aria-label={`${BRAND.name} home`}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to homepage
            </Link>
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-surface">
        <Container className="flex flex-col gap-2 py-6 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {BRAND.name}
          </p>
          <p>Pre-launch build · Stage 3</p>
        </Container>
      </footer>
    </div>
  );
}
