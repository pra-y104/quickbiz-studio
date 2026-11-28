import type { ReactNode } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router';
import { AUTH_COPY } from '../../content/auth';
import { cn } from '../../lib/cn';
import { Logo } from '../brand/logo';
import { Container } from '../ui/container';
import { ThemeToggle } from '../ui/theme-toggle';

export interface AuthShellProps {
  /** Headline for the form column. */
  title: string;
  subtitle: string;
  /** Form, notices and links. */
  children: ReactNode;
  /** Optional content rendered under the card (legal note, alternative action). */
  footer?: ReactNode;
  /** Hide the brand panel for focused screens such as verification. */
  compact?: boolean;
  className?: string;
}

/**
 * Chrome shared by every authentication screen.
 *
 * Desktop shows a dark brand panel beside the form; on phones the panel is
 * dropped and the form takes the full width, which keeps the first field above
 * the fold on a 360 px screen.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  compact,
  className,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-border bg-canvas/85 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between gap-3">
          <Link
            to="/"
            aria-label="QuickBiz Studio home"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Back to homepage</span>
              <span className="sm:hidden">Home</span>
            </Link>
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main id="main" className="flex-1">
        <Container className="py-8 sm:py-12">
          <div
            className={cn(
              'mx-auto grid w-full',
              compact ? 'max-w-md' : 'max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch',
              className,
            )}
          >
            {compact ? null : <BrandPanel />}

            <section
              aria-labelledby="auth-heading"
              className="flex flex-col justify-center rounded-card border border-border bg-surface p-6 shadow-elev-1 sm:p-8"
            >
              <div className="mx-auto w-full max-w-sm">
                <h1
                  id="auth-heading"
                  className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
                >
                  {title}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{subtitle}</p>

                <div className="mt-6 space-y-5">{children}</div>

                {footer ? <div className="mt-6 border-t border-border pt-5">{footer}</div> : null}
              </div>
            </section>
          </div>
        </Container>
      </main>

      <footer className="border-t border-border">
        <Container className="flex flex-col gap-1 py-4 text-[11px] text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>Free tools are live now · AI tools and payments are being enabled.</p>
          <p>All account data stays behind Supabase row-level security.</p>
        </Container>
      </footer>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative isolate hidden overflow-hidden rounded-card bg-navy-950 p-8 lg:flex lg:flex-col">
      <div className="qb-aura absolute inset-0 -z-10" aria-hidden="true" />
      <div className="qb-grid absolute inset-0 -z-10" aria-hidden="true" />

      <span className="inline-flex w-fit items-center gap-2 rounded-pill border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/60">
        Accounts
      </span>

      <div className="mt-6">
        <p className="text-2xl font-semibold leading-tight tracking-tight text-white">
          {AUTH_COPY.common.brandPanelTitle}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          {AUTH_COPY.common.brandPanelBody}
        </p>
      </div>

      <ul className="mt-auto space-y-3 pt-8">
        {AUTH_COPY.common.brandPanelPoints.map((point) => (
          <li key={point} className="flex gap-2.5 text-sm text-white/65">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-brand-200">
              <Check className="size-3" aria-hidden="true" />
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
