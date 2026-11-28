import type { ReactNode } from 'react';
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Wrench,
  ArrowLeft,
} from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router';
import { BRAND } from '@quickbiz/shared';
import { useAuth } from '../../lib/auth/auth-context';
import { cn } from '../../lib/cn';

export interface AdminNavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: typeof LayoutDashboard;
  readonly end?: boolean;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/wallets', label: 'Wallets', icon: Wallet },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/referrals', label: 'Referrals', icon: Share2 },
  { to: '/admin/tools', label: 'Tools', icon: Wrench },
  { to: '/admin/ai', label: 'AI Providers', icon: Sparkles },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
];

interface AdminShellProps {
  children: ReactNode;
  title: string;
  description?: string;
}

/**
 * Chrome for the admin dashboard: a premium, always-dark surface consistent
 * with QuickBiz Studio branding. The palette is fixed to the brand navy so the
 * admin area reads as a distinct, focused console in both site themes.
 */
export function AdminShell({ children, title, description }: AdminShellProps) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-navy-950 text-navy-100">
      <header className="border-b border-navy-800 bg-navy-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-white">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <span className="hidden text-sm font-semibold tracking-tight sm:inline">
                {BRAND.name}
              </span>
            </Link>
            <span className="rounded-pill border border-brand-500/40 bg-brand-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-navy-300 transition-colors hover:bg-navy-900 hover:text-navy-100 sm:inline-flex"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to app
            </Link>
            <Button onClick={handleSignOut} />
          </div>
        </div>

        {/* Mobile section nav */}
        <nav
          aria-label="Admin sections"
          className="flex gap-1 overflow-x-auto border-t border-navy-800 px-3 py-2 lg:hidden"
        >
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-500/20 text-brand-200'
                    : 'text-navy-300 hover:bg-navy-900 hover:text-navy-100',
                )
              }
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav aria-label="Admin sections" className="sticky top-6 space-y-1">
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-500/20 text-brand-200'
                      : 'text-navy-300 hover:bg-navy-900 hover:text-navy-100',
                  )
                }
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-navy-300">
                {description}
              </p>
            ) : null}
          </div>
          {children}
        </main>
      </div>

      <footer className="border-t border-navy-800">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-[11px] text-navy-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getUTCFullYear()} {BRAND.name} · Admin
          </p>
          <p className="truncate">
            {session?.user.email ? `Signed in as ${session.user.email}` : 'Admin console'}
          </p>
        </div>
      </footer>
    </div>
  );

  function Button({ onClick }: { onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-sm font-medium text-navy-200 transition-colors hover:bg-navy-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    );
  }
}
