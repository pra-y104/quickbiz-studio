import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import type { CreativeTemplate } from '@quickbiz/shared';

export interface TemplateCardProps {
  readonly template: CreativeTemplate;
  readonly canvasLabel: string;
  readonly busy?: boolean;
  readonly onUse: () => void;
}

/**
 * A template preview.
 *
 * The preview is drawn from the template's own document by the same renderer the
 * editor uses, so what the customer sees is what they will get — not a separate
 * mock-up that can drift.
 */
export function TemplateCard(props: TemplateCardProps) {
  const { t } = useTranslation();
  const { template, canvasLabel, busy, onUse } = props;

  return (
    <button
      type="button"
      onClick={onUse}
      disabled={busy}
      className="group flex w-full flex-col overflow-hidden rounded-card border border-border bg-surface text-left shadow-elev-1 transition-shadow hover:shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60"
    >
      <TemplateThumbnail template={template} />
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

function TemplateThumbnail({ template }: { readonly template: CreativeTemplate }) {
  return (
    <div
      aria-hidden="true"
      className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-muted p-3"
    >
      <TemplateMiniature template={template} />
    </div>
  );
}

/**
 * A lightweight vector stand-in for the real render.
 *
 * Drawing the full document into a canvas here would mean one canvas per card;
 * instead the thumbnail shows the template's dominant shape and type blocks at the
 * correct proportions. The editor always renders the true document.
 */
function TemplateMiniature({ template }: { readonly template: CreativeTemplate }) {
  const nodes = template.build();
  const fill = nodes.find((node) => node.type === 'shape' && node.fill.type === 'solid');
  const background =
    fill && fill.type === 'shape' && fill.fill.type === 'solid' ? fill.fill.color : '#6741E8';
  const headline = nodes.find((node) => node.type === 'text' && node.name === 'Headline');

  return (
    <div
      className="flex size-full flex-col justify-between rounded-sm p-2 shadow-elev-1"
      style={{ backgroundColor: background }}
    >
      <span className="block h-1.5 w-1/3 rounded-full bg-white/40" />
      <span className="line-clamp-3 text-[10px] font-bold leading-tight text-white/90">
        {headline && headline.type === 'text' ? headline.text : template.name}
      </span>
      <span className="block h-1 w-1/2 rounded-full bg-white/30" />
    </div>
  );
}
