import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, Wand2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { isAiImageEnabled, isAiTextEnabled } from '../../lib/creative/flags';

export interface AiAssistDialogProps {
  readonly open: boolean;
  readonly mode: 'text' | 'image' | null;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Honest placeholder for both AI capabilities.
 *
 * It states what is missing and what still works. It never renders a fake result,
 * never implies a provider is connected, and shows no pricing because none has
 * been approved.
 */
export function AiAssistDialog({ open, mode, onOpenChange }: AiAssistDialogProps) {
  const { t } = useTranslation();

  const textEnabled = isAiTextEnabled();
  const imageEnabled = isAiImageEnabled();
  const isText = mode === 'text';
  const enabled = isText ? textEnabled : imageEnabled;

  const title = isText ? t('studio.aiTextTitle') : t('studio.aiImageTitle');
  const body = isText ? t('studio.aiTextBody') : t('studio.aiImageBody');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-5 shadow-elev-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary"
              >
                {isText ? <Sparkles className="size-4" /> : <Wand2 className="size-4" />}
              </span>
              <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label={t('studio.close')}>
                <X className="size-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-3 text-sm leading-relaxed text-ink-muted">
            {body}
          </Dialog.Description>

          {!enabled ? (
            <p className="mt-3 rounded-lg bg-surface-muted p-3 text-xs leading-relaxed text-ink-muted">
              {t('studio.aiDisabledNote')}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('studio.close')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
