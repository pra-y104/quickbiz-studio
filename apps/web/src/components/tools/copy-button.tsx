import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';

export interface CopyButtonProps {
  readonly value: string;
  /** Button label while idle. */
  readonly label?: string;
  readonly className?: string;
  readonly disabled?: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** Copy-to-clipboard control with an explicit success and failure state. */
export function CopyButton({ value, label = 'Copy', className, disabled }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2_000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy(): Promise<void> {
    if (value.length === 0) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for browsers that block the async clipboard API.
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        if (!copied) throw new Error('copy command refused');
      }
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('shrink-0', className)}
      onClick={() => void copy()}
      disabled={disabled || value.length === 0}
    >
      {state === 'copied' ? (
        <Check className="size-3.5 text-success" aria-hidden="true" />
      ) : state === 'failed' ? (
        <TriangleAlert className="size-3.5 text-danger" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
      </span>
    </Button>
  );
}
