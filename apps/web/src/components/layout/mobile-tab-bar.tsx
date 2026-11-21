import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { LayoutGrid, UserPlus } from 'lucide-react';
import { useOptionalAuth } from '../../lib/auth/auth-context';

/**
 * Sticky mobile navigation.
 *
 * Two destinations only, because that is what a first-time visitor on a phone
 * needs: browse the tools, or create an account. It appears below `lg`, sits
 * above page content with safe-area padding, and never overlaps the footer
 * because the marketing pages reserve space for it.
 */
export function MobileTabBar() {
  const { t } = useTranslation();
  const session = useOptionalAuth()?.session ?? null;
  const location = useLocation();

  const onTools = location.pathname.startsWith('/tools');

  return (
    <nav
      aria-label={t('home.mobileNav')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        <li className="flex-1">
          <Link
            to="/tools"
            aria-current={onTools ? 'page' : undefined}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              onTools ? 'text-primary' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <LayoutGrid className="size-5" aria-hidden="true" />
            {t('home.browseTools')}
          </Link>
        </li>
        <li className="flex-1">
          <Link
            to={session ? '/dashboard' : '/register'}
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <UserPlus className="size-5" aria-hidden="true" />
            {session ? t('home.account') : t('home.join')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
