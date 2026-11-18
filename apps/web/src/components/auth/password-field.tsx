import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { AUTH_COPY } from '../../content/auth';
import { cn } from '../../lib/cn';
import { Field } from '../ui/field';
import { Input } from '../ui/input';

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
  error?: string;
  /** Adds `autoComplete` guidance for password managers. */
  mode?: 'current' | 'new';
}

/**
 * Password input with a show/hide control.
 *
 * The button is a real toggle with `aria-pressed`, reachable by keyboard and
 * screen reader, and it never submits the form.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ label, hint, error, id, mode = 'current', className, ...props }, ref) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const [visible, setVisible] = useState(false);

    return (
      <Field label={label} htmlFor={fieldId} hint={hint} error={error} required>
        <div className="relative">
          <Input
            ref={ref}
            id={fieldId}
            type={visible ? 'text' : 'password'}
            autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
            className={cn('pr-11', className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-pressed={visible}
            aria-label={visible ? AUTH_COPY.common.hidePassword : AUTH_COPY.common.showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-ink-subtle transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60"
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </Field>
    );
  },
);
