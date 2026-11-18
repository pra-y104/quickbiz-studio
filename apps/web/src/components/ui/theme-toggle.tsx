import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export const THEME_STORAGE_KEY = 'qb-theme';
export type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * Light/dark switch. The initial theme is resolved by an inline script in
 * index.html before first paint, so this component only reflects and updates it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(currentTheme);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable in private mode; the theme still applies.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      aria-pressed={theme === 'dark'}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-ink-muted',
        'transition-colors hover:bg-surface-muted hover:text-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        className,
      )}
    >
      {theme === 'dark' ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
