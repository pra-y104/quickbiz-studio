import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Placeholder block used while content loads. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
