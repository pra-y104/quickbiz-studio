import type { ReactNode } from 'react';
import { LayoutDashboard, LogOut, UserRound, Wallet } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router';
import { BRAND } from '@quickbiz/shared';
import { AUTH_COPY } from '../../content/auth';
import { Logo } from '../brand/logo';
import { Button } from '../ui/button';
import { Container } from '../ui/container';
import { ThemeToggle } from '../ui/theme-toggle';
import { useAuth } from '../../lib/auth/auth-context';
import { cn } from '../../lib/cn';

const NAV = [
  { to: '/dashboard', label: AUTH_COPY.account.dashboard, icon: LayoutDashboard },
  { to: '/wallet', label: AUTH_COPY.account.wallet, icon: Wallet },
  { to: '/profile', label: AUTH_COPY.account.profile, icon: UserRound },
] as const;

export interface AccountShellProps {
  children: ReactNode;
  title: string;
  description?: string;
}

/** Chrome for signed-in screens: account navigation, identity and sign out. */
export function AccountShell({ children, title, description }: AccountShellProps) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-border bg-canvas/85 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              aria-label={`${BRAND.name} home`}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <Logo showWordmark={false} className="sm:hidden" />
              <Logo className="hidden sm:inline-flex" />
            </Link>

            <nav aria-label="Account" className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-soft text-primary'
                        : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                    )
                  }
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {session?.user.email ? (
              <span className="hidden max-w-[14rem] truncate text-xs text-ink-subtle lg:inline">
                {session.user.email}
              </span>
            ) : null}
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{AUTH_COPY.account.signOut}</span>
            </Button>
          </div>
        </Container>

        <nav
          aria-label="Account"
          className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 sm:hidden"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-primary-soft text-primary' : 'text-ink-muted',
                )
              }
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className="flex-1">
        <Container className="py-8 sm:py-10">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          {children}
        </Container>
      </main>

      <footer className="border-t border-border">
        <Container className="flex flex-col gap-1 py-4 text-[11px] text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getUTCFullYear()} {BRAND.name}
          </p>
          <p>Pre-launch build · Account foundation only</p>
        </Container>
      </footer>
    </div>
  );
}
