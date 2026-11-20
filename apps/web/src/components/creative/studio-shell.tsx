import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { Spinner } from '../ui/spinner';

export type StudioSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface StudioShellProps {
  readonly title: string;
  readonly canvasLabel: string;
  readonly saveState: StudioSaveState;
  readonly onBack: () => void;
  readonly actions?: ReactNode;
  readonly rail: ReactNode;
  readonly canvas: ReactNode;
  readonly inspector: ReactNode;
  /** Bottom toolbar for narrow screens. */
  readonly mobileBar?: ReactNode;
}

function SaveIndicator({ state }: { readonly state: StudioSaveState }) {
  const { t } = useTranslation();
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <Spinner className="size-3.5" />
        {t('studio.saving')}
      </span>
    );
  }
  if (state === 'saved') {
    return <span className="text-xs font-medium text-success">{t('studio.savedLocally')}</span>;
  }
  if (state === 'error') {
    return (
      <span role="alert" className="text-xs font-medium text-danger">
        {t('studio.saveNotSaved')}
      </span>
    );
  }
  return null;
}

/**
 * The editor frame.
 *
 * Three regions on desktop (rail, canvas, inspector), collapsing to a canvas with
 * a bottom toolbar on phones. The shell owns no editing state: it renders slots,
 * so the document engine and the React panels stay independent of layout.
 */
export function StudioShell(props: StudioShellProps) {
  const { t } = useTranslation();
  const { title, canvasLabel, saveState, onBack, actions, rail, canvas, inspector, mobileBar } =
    props;

  return (
    <div className="flex h-dvh min-h-dvh flex-col bg-canvas text-ink">
      <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-3 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
          aria-label={t('studio.backToProjects')}
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-ink">{title}</p>
          <p className="truncate text-xs leading-tight text-ink-subtle">{canvasLabel}</p>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <SaveIndicator state={saveState} />
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t('studio.tools')}
          className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-3 md:flex"
        >
          {rail}
        </nav>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              'relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4',
              'bg-[radial-gradient(circle_at_1px_1px,theme(colors.border)_1px,transparent_0)] [background-size:18px_18px]',
            )}
          >
            {canvas}
          </div>
          {mobileBar ? (
            <div className="shrink-0 border-t border-border bg-surface px-2 py-2 md:hidden">
              {mobileBar}
            </div>
          ) : null}
        </main>

        <aside
          aria-label={t('studio.properties')}
          className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface lg:flex"
        >
          {inspector}
        </aside>
      </div>
    </div>
  );
}
