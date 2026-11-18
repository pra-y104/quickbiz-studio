import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface DisclosureProps {
  question: string;
  answer: ReactNode;
  className?: string;
}

/**
 * Accessible single-item disclosure built on native <details>.
 * Native semantics give keyboard support and screen-reader behaviour for free.
 */
export function Disclosure({ question, answer, className }: DisclosureProps) {
  return (
    <details
      className={cn(
        'group rounded-card border border-border bg-surface transition-colors open:border-border-strong',
        className,
      )}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left',
          'text-sm font-medium text-ink transition-colors hover:text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <span>{question}</span>
        <ChevronDown
          className="size-4 shrink-0 text-ink-subtle transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-5 pb-5 text-sm leading-relaxed text-ink-muted">{answer}</div>
    </details>
  );
}
