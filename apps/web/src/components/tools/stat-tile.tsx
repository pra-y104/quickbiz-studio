import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface StatTileProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: string;
  readonly className?: string;
  /** Emphasises the primary metrics in a dense grid. */
  readonly emphasis?: boolean;
}

export function StatTile({ label, value, hint, className, emphasis = false }: StatTileProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface px-3.5 py-3',
        emphasis && 'border-primary/20 bg-primary-soft/60',
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
        {label}
      </p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums text-ink', emphasis && 'text-2xl')}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3', className)}>{children}</div>;
}
