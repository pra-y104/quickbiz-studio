import { getPasswordStrength } from '@quickbiz/shared';
import { Check, X } from 'lucide-react';
import { cn } from '../../lib/cn';

const BARS = [1, 2, 3, 4] as const;

const BAR_TONES: Readonly<Record<number, string>> = {
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-accent',
  4: 'bg-success',
};

export interface PasswordStrengthProps {
  password: string;
  className?: string;
  /** Announce changes politely; turn off when the field already has a live region. */
  live?: boolean;
}

/**
 * Strength meter plus a checklist of the rules that actually gate submission.
 *
 * The meter is guidance. The shared zod schema is the gate, so the two cannot
 * disagree about whether a password is acceptable.
 */
export function PasswordStrength({ password, className, live = true }: PasswordStrengthProps) {
  const strength = getPasswordStrength(password);
  const active = strength.score;

  const requirements = [
    { met: strength.met.length, label: 'At least 10 characters' },
    { met: strength.met.letter, label: 'A letter' },
    { met: strength.met.digit, label: 'A number' },
    { met: strength.met.symbol || strength.met.mixedCase, label: 'A symbol or mixed case' },
  ];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex flex-1 gap-1"
          role={live ? 'meter' : undefined}
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={active === 0 ? 1 : active}
          aria-label="Password strength"
        >
          {BARS.map((bar) => (
            <span
              key={bar}
              className={cn(
                'h-1.5 flex-1 rounded-pill transition-colors duration-200',
                bar <= active ? BAR_TONES[active] : 'bg-border',
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            'min-w-[3.75rem] text-right text-[11px] font-medium',
            active === 0 ? 'text-ink-subtle' : 'text-ink-muted',
          )}
        >
          {password ? strength.label : 'Strength'}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {requirements.map((requirement) => (
          <li
            key={requirement.label}
            className={cn(
              'flex items-center gap-1.5 text-[11px]',
              requirement.met ? 'text-ink-muted' : 'text-ink-subtle',
            )}
          >
            {requirement.met ? (
              <Check className="size-3 text-success" aria-hidden="true" />
            ) : (
              <X className="size-3 text-ink-subtle" aria-hidden="true" />
            )}
            <span>{requirement.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
