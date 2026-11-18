import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 6, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full resize-y rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink',
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
});
