import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes, type ElementType } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks repeated submits. */
  loading?: boolean;
  /** Renders the child element (for example a router link) with button styling. */
  asChild?: boolean;
}

const BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-55';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary shadow-elev-1 hover:bg-primary-hover',
  secondary: 'bg-surface-muted text-ink hover:bg-border',
  outline: 'border border-border-strong bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    asChild = false,
    disabled,
    type,
    children,
    ...props
  },
  ref,
) {
  const Component = (asChild ? Slot : 'button') as ElementType;
  const isDisabled = asChild ? undefined : Boolean(disabled) || loading;

  return (
    <Component
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...(asChild ? {} : { type: type ?? 'button', disabled: isDisabled })}
      aria-busy={loading || undefined}
      data-loading={loading ? '' : undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : loading ? (
        <>
          <Spinner className="size-4" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Component>
  );
});
