import { ArrowRight, Menu } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { HOMEPAGE_ANNOUNCEMENT, HOMEPAGE_NAV } from '../../content/homepage';
import { Logo } from '../brand/logo';
import { Button } from '../ui/button';
import { Container } from '../ui/container';
import { ThemeToggle } from '../ui/theme-toggle';
import { useAuth } from '../../lib/auth/auth-context';

/** Loaded on first open (and warmed during idle) to keep the first paint light. */
const MobileMenu = lazy(() =>
  import('./mobile-menu').then((module) => ({ default: module.MobileMenu })),
);

const NAV_LINK_CLASS =
  'rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink';

function AnnouncementBar() {
  return (
    <div className="bg-navy-950 text-white/60">
      <Container className="flex items-center justify-center gap-2 py-2 text-center text-[11px] sm:text-xs">
        <span
          className="inline-flex size-1.5 shrink-0 rounded-full bg-brand-400"
          aria-hidden="true"
        />
        <p>{HOMEPAGE_ANNOUNCEMENT}</p>
      </Container>
    </div>
  );
}

export function SiteHeader() {
  const { session } = useAuth();
  const [menuRequested, setMenuRequested] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Warm the drawer chunk after the page is interactive.
    const timer = window.setTimeout(() => {
      void import('./mobile-menu');
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between gap-3">
          <Link
            to="/"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            aria-label="QuickBiz Studio home"
          >
            <Logo />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {HOMEPAGE_NAV.map((item) => (
              <a key={item.href} href={item.href} className={NAV_LINK_CLASS}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {session ? (
              <Button asChild size="sm">
                <Link to="/dashboard">
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Account</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/register">
                    <span className="hidden sm:inline">Get started</span>
                    <span className="sm:hidden">Join</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              aria-label="Open navigation menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuRequested(true);
                setMenuOpen(true);
              }}
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </Container>
      </header>

      {menuRequested ? (
        <Suspense fallback={null}>
          <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
