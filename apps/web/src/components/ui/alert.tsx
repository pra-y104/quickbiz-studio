import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}

const TONES: Record<AlertTone, { container: string; icon: ReactNode }> = {
  info: {
    container: 'border-accent/25 bg-accent-soft text-ink',
    icon: <Info className="size-4 text-accent" aria-hidden="true" />,
  },
  success: {
    container: 'border-success/25 bg-success-soft text-ink',
    icon: <CheckCircle2 className="size-4 text-success" aria-hidden="true" />,
  },
  warning: {
    container: 'border-warning/25 bg-warning-soft text-ink',
    icon: <TriangleAlert className="size-4 text-warning" aria-hidden="true" />,
  },
  danger: {
    container: 'border-danger/25 bg-danger-soft text-ink',
    icon: <AlertCircle className="size-4 text-danger" aria-hidden="true" />,
  },
};

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const { container, icon } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-3.5 text-sm', container, className)}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-ink-muted">{children}</div> : null}
      </div>
    </div>
  );
}
