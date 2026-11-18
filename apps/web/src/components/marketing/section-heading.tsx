import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
  /** Optional action rendered on the same row on large screens. */
  action?: ReactNode;
  /** Light text for use on the dark hero band. */
  tone?: 'default' | 'inverse';
  /** Optional id used by aria-labelledby on the surrounding section. */
  titleId?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  action,
  tone = 'default',
  titleId,
}: SectionHeadingProps) {
  const inverse = tone === 'inverse';

  return (
    <div
      className={cn(
        'flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        <p
          className={cn(
            'text-xs font-semibold uppercase tracking-[0.16em]',
            inverse ? 'text-brand-300' : 'text-primary',
          )}
        >
          {eyebrow}
        </p>
        <h2
          id={titleId}
          className={cn(
            'mt-2.5 text-2xl font-semibold tracking-tight sm:text-3xl',
            inverse ? 'text-white' : 'text-ink',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              'mt-3 text-sm leading-relaxed sm:text-base',
              inverse ? 'text-white/65' : 'text-ink-muted',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
