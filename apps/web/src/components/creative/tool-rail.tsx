import {
  Image as ImageIcon,
  Layers,
  MousePointer2,
  Shapes,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StudioTool } from './canvas-stage';
import { isAiImageEnabled, isAiTextEnabled } from '../../lib/creative/flags';

export interface ToolRailProps {
  readonly tool: StudioTool;
  readonly onToolChange: (tool: StudioTool) => void;
  readonly onAddText: () => void;
  readonly onAddShape: () => void;
  readonly onUploadImage: () => void;
  readonly onOpenTemplates: () => void;
  readonly onOpenAiPanel: (panel: 'text' | 'image') => void;
}

interface RailButtonProps {
  readonly label: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function RailButton({ label, active, disabled, onClick, children }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={label}
      className={`flex size-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-primary-soft text-primary'
          : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * Vertical tool rail.
 *
 * Every control is a real action: adding, uploading or opening a panel. AI entries
 * stay present but disabled with an explanation, so the product does not pretend
 * that a paid capability exists.
 */
export function ToolRail(props: ToolRailProps) {
  const { t } = useTranslation();
  const {
    tool,
    onToolChange,
    onAddText,
    onAddShape,
    onUploadImage,
    onOpenTemplates,
    onOpenAiPanel,
  } = props;

  return (
    <div className="flex flex-col items-center gap-1">
      <RailButton
        label={t('studio.select')}
        active={tool === 'select'}
        onClick={() => onToolChange('select')}
      >
        <MousePointer2 className="size-5" aria-hidden="true" />
      </RailButton>
      <RailButton label={t('studio.text')} active={tool === 'text'} onClick={onAddText}>
        <Type className="size-5" aria-hidden="true" />
      </RailButton>
      <RailButton label={t('studio.shapes')} onClick={onAddShape}>
        <Shapes className="size-5" aria-hidden="true" />
      </RailButton>
      <RailButton label={t('studio.images')} active={tool === 'image'} onClick={onUploadImage}>
        <ImageIcon className="size-5" aria-hidden="true" />
      </RailButton>
      <RailButton label={t('studio.templates')} onClick={onOpenTemplates}>
        <Layers className="size-5" aria-hidden="true" />
      </RailButton>

      <div className="my-1 h-px w-6 bg-border" aria-hidden="true" />

      <RailButton
        label={`${t('studio.aiTextTitle')} — ${isAiTextEnabled() ? '' : t('studio.aiTextBody')}`}
        disabled={!isAiTextEnabled()}
        onClick={() => onOpenAiPanel('text')}
      >
        <Sparkles className="size-5" aria-hidden="true" />
      </RailButton>
      <RailButton
        label={`${t('studio.aiImageTitle')} — ${isAiImageEnabled() ? '' : t('studio.aiImageBody')}`}
        disabled={!isAiImageEnabled()}
        onClick={() => onOpenAiPanel('image')}
      >
        <Wand2 className="size-5" aria-hidden="true" />
      </RailButton>
    </div>
  );
}
