import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import type { CreativeTemplate } from '@quickbiz/shared';
import { renderTemplateThumbnail } from '../../lib/creative/render/template-thumbnail';

export interface TemplateCardProps {
  readonly template: CreativeTemplate;
  readonly canvasLabel: string;
  readonly busy?: boolean;
  readonly onUse: () => void;
}

/**
 * A template preview.
 *
 * The thumbnail is a real render of the template document through the same
 * renderer the editor and exporter use, so the card shows what the customer will
 * actually open. Rendering happens once per card after mount; if the browser
 * cannot provide a canvas the card falls back to a labelled placeholder rather
 * than an empty box.
 */
export function TemplateCard(props: TemplateCardProps) {
  const { t } = useTranslation();
  const { template, canvasLabel, busy, onUse } = props;

  // Rendered once per template and cached by the thumbnail module; computing it
  // during render keeps the card free of state and avoids an effect-driven cascade.
  const thumbnail = useMemo(() => renderTemplateThumbnail(template), [template]);

  return (
    <button
      type="button"
      onClick={onUse}
      disabled={busy}
      className="group flex w-full flex-col overflow-hidden rounded-card border border-border bg-surface text-left shadow-elev-1 transition-shadow hover:shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-muted">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="size-full object-contain"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="px-3 text-center text-[11px] font-medium text-ink-subtle">
            {t('studio.templatePreviewUnavailable')}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{template.name}</p>
          <p className="truncate text-xs text-ink-subtle">{canvasLabel}</p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform group-hover:translate-x-0.5">
          <ArrowUpRight className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('studio.useTemplate')}</span>
        </span>
      </div>
    </button>
  );
}
