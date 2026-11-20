import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, X } from 'lucide-react';
import type { CreativeDocument } from '@quickbiz/shared';
import type { RenderAsset } from '../../lib/creative/render/render-document';
import {
  exportDesign,
  exportExtension,
  EXPORT_SCALE_OPTIONS,
  type ExportFormat,
} from '../../lib/creative/export';
import { Button } from '../ui/button';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export interface ExportDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly document: CreativeDocument;
  readonly assets: ReadonlyMap<string, RenderAsset>;
}

const FORMATS: readonly ExportFormat[] = ['png', 'jpeg', 'pdf'];

/**
 * Export dialog.
 *
 * Formats are produced locally. The dialog states the PDF limitation plainly
 * rather than implying vector output, and reports a size problem as a readable
 * message instead of failing silently.
 */
export function ExportDialog(props: ExportDialogProps) {
  const { t } = useTranslation();
  const { open, onOpenChange, document: doc, assets } = props;

  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setDone(null);
    try {
      const result = await exportDesign({
        document: doc,
        assets,
        format,
        scale,
        transparentBackground: transparent,
      });
      triggerDownload(result.blob, result.filename);
      setDone(result.filename);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('studio.exportFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface p-5 shadow-elev-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Dialog.Title className="text-base font-semibold text-ink">
                {t('studio.exportTitle')}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-ink-muted">
                {t('studio.exportBody')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label={t('studio.close')}>
                <X className="size-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium text-ink">{t('studio.exportFormat')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value)}
                  aria-pressed={format === value}
                  className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                    format === value
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-surface text-ink-muted hover:bg-surface-muted'
                  }`}
                >
                  {value === 'jpeg' ? 'JPG' : value.toUpperCase()}
                  <span className="sr-only"> .{exportExtension(value)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium text-ink">{t('studio.exportScale')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {EXPORT_SCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScale(option.value)}
                  aria-pressed={scale === option.value}
                  className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                    scale === option.value
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-surface text-ink-muted hover:bg-surface-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          {format === 'png' ? (
            <label className="mt-4 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => setTransparent(event.target.checked)}
                className="size-4 rounded border-border-strong"
              />
              {t('studio.exportTransparent')}
            </label>
          ) : null}

          {format === 'pdf' ? (
            <p className="mt-3 rounded-lg bg-surface-muted p-3 text-xs leading-relaxed text-ink-muted">
              {t('studio.exportPdfNote')}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          {done ? (
            <p role="status" className="mt-3 text-sm font-medium text-success">
              {t('studio.exportDone')} {done}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('studio.close')}
            </Button>
            <Button onClick={() => void run()} loading={pending}>
              <Download className="size-4" aria-hidden="true" />
              {t('studio.export')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
