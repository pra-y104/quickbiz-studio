import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Native select styled to match the other form controls. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border border-border-strong bg-surface py-0 pl-3 pr-9 text-base text-ink sm:text-sm',
            'transition-colors focus-visible:border-primary focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-focus/35',
            'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25',
            'disabled:cursor-not-allowed disabled:opacity-60',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
      </div>
    );
  },
);
