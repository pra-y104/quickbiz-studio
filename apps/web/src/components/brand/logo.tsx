/**
 * Brand mark and wordmark.
 *
 * The mark is a bolt on a violet-to-blue tile: speed and completion, with no
 * circular "lens" form that could be mistaken for a magnifying glass. The same
 * geometry drives the favicon and the home-screen icons
 * (`scripts/generate-brand-icons.mjs`), so the identity cannot drift between
 * browser tab, header and installed app.
 *
 * The tile keeps the brand gradient so light and dark themes stay recognisable,
 * and the bolt stays legible down to 16 px because it has no thin details.
 */

import { useId } from 'react';
import { BRAND } from '@quickbiz/shared';
import { cn } from '../../lib/cn';

export interface LogoMarkProps {
  readonly className?: string;
  /** Monochrome variant for dark or single-colour contexts. */
  readonly monochrome?: boolean;
}

/** Bolt path in a 48 × 48 box, shared with the icon generator. */
export const BOLT_PATH = 'M28.5 6 14 26.5h7.6L19 42l15.5-21h-8.2z';

export function LogoMark({ className, monochrome = false }: LogoMarkProps) {
  const gradientId = useId();

  return (
    <svg viewBox="0 0 48 48" className={cn('size-8', className)} role="img" aria-label={BRAND.name}>
      {monochrome ? (
        <rect width="48" height="48" rx="12" fill="currentColor" />
      ) : (
        <>
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2="48"
              y2="48"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#7C5CFF" />
              <stop offset="1" stopColor="#2E8DFF" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="12" fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={BOLT_PATH} fill={monochrome ? '#FFFFFF' : '#FFFFFF'} />
    </svg>
  );
}

export interface LogoProps {
  readonly className?: string;
  readonly showWordmark?: boolean;
}

export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showWordmark ? (
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-[17px] font-semibold leading-none tracking-[-0.02em] text-ink">
            {BRAND.wordmark.primary}
          </span>
          <span className="text-[17px] font-normal leading-none tracking-[-0.01em] text-ink-muted">
            {BRAND.wordmark.secondary}
          </span>
        </span>
      ) : null}
    </span>
  );
}
