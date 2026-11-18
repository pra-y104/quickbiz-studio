import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-ink',
          'placeholder:text-ink-subtle',
          'transition-colors focus-visible:border-primary focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-focus/35',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);
