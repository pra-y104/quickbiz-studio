import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, X } from 'lucide-react';
import {
  CREATIVE_PRESETS,
  canvasFromPreset,
  createCreativeDocument,
  type CreativeDocument,
} from '@quickbiz/shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface NewDesignDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Called with a fully validated, unsaved document. */
  readonly onCreate: (document: CreativeDocument) => void;
  readonly pending?: boolean;
}

/**
 * Create a design from a canvas preset.
 *
 * The chosen preset is converted into a document here, so the caller only ever
 * receives data that has already passed the shared schema.
 */
export function NewDesignDialog({ open, onOpenChange, onCreate, pending }: NewDesignDialogProps) {
  const { t } = useTranslation();
  const [presetId, setPresetId] = useState<string>(CREATIVE_PRESETS[0]?.id ?? 'social-square');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selected = CREATIVE_PRESETS.find((preset) => preset.id === presetId);

  function submit() {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError(t('studio.nameRequired'));
      return;
    }
    const preset = CREATIVE_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) {
      setError(t('studio.canvasLabel'));
      return;
    }

    setError(null);
    onCreate(
      createCreativeDocument({
        title: trimmed.slice(0, 120),
        canvas: canvasFromPreset(preset),
      }),
    );
    setTitle('');
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[min(92vw,44rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-elev-3">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div className="space-y-1">
              <Dialog.Title className="text-lg font-semibold text-ink">
                {t('studio.dialogTitle')}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-ink-muted">
                {t('studio.dialogBody')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close new design dialog">
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">{t('studio.nameLabel')}</span>
              <Input
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('studio.namePlaceholder')}
              />
            </label>

            <fieldset className="mt-5 space-y-2">
              <legend className="text-sm font-medium text-ink">{t('studio.canvasLabel')}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CREATIVE_PRESETS.map((preset) => {
                  const active = preset.id === presetId;
                  const dimensions =
                    preset.unit === 'mm'
                      ? `${preset.width} × ${preset.height} mm`
                      : `${preset.width} × ${preset.height} px`;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPresetId(preset.id)}
                      aria-pressed={active}
                      className={`flex min-h-[44px] items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'border-primary bg-primary-soft'
                          : 'border-border bg-surface hover:bg-surface-muted'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {preset.name}
                        </span>
                        <span className="block truncate text-xs text-ink-subtle">
                          {dimensions} · {preset.category === 'print' ? t('studio.print') : t('studio.digital')}
                        </span>
                      </span>
                      {active ? (
                        <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {error ? (
              <p role="alert" className="mt-3 text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('studio.cancel')}
            </Button>
            <Button onClick={submit} loading={pending} disabled={!selected}>
              {t('studio.create')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}