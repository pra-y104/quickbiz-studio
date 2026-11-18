import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface ResultPanelProps {
  readonly label: string;
  readonly value: ReactNode;
  /** Secondary explanation under the value. */
  readonly detail?: ReactNode;
  readonly tone?: 'brand' | 'success' | 'neutral';
  readonly children?: ReactNode;
  readonly className?: string;
}

const TONES = {
  brand: 'border-primary/25 bg-primary-soft',
  success: 'border-success/25 bg-success-soft',
  neutral: 'border-border bg-surface-muted',
} as const;

/**
 * The single emphasised answer on a tool page. Announced politely so a screen
 * reader user hears the new value after changing an input.
 */
export function ResultPanel({
  label,
  value,
  detail,
  tone = 'brand',
  children,
  className,
}: ResultPanelProps) {
  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className={cn('rounded-card border p-5', TONES[tone], className)}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className="mt-2 break-words text-3xl font-semibold tabular-nums tracking-tight text-ink sm:text-4xl">
        {value}
      </p>
      {detail ? <p className="mt-2 text-sm leading-relaxed text-ink-muted">{detail}</p> : null}
      {children}
    </section>
  );
}
