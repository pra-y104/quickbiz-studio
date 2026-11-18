import { useId } from 'react';
import { BRAND } from '@quickbiz/shared';
import { cn } from '../../lib/cn';

export interface LogoMarkProps {
  className?: string;
}

/**
 * QuickBiz Studio monogram: a rounded tile with a violet-to-electric gradient and
 * a geometric "Q" aperture. The mark stays legible at 16px, which is why the
 * inner form is simplified rather than detailed.
 */
export function LogoMark({ className }: LogoMarkProps) {
  const gradientId = useId();

  return (
    <svg viewBox="0 0 48 48" className={cn('size-8', className)} role="img" aria-label={BRAND.name}>
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
      <path
        d="M24 12a12 12 0 1 0 7.6 21.3l3.3 3.3a2.25 2.25 0 0 0 3.2-3.2l-3.3-3.3A12 12 0 0 0 24 12Zm0 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Z"
        fill="#FFFFFF"
        fillOpacity="0.96"
      />
    </svg>
  );
}

export interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showWordmark ? (
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          {BRAND.wordmark.primary}
          {BRAND.wordmark.secondary ? (
            <span className="font-normal text-ink-muted"> {BRAND.wordmark.secondary}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
