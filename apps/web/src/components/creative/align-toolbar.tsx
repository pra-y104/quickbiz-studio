import { useTranslation } from 'react-i18next';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
} from 'lucide-react';
import type { AlignMode } from '../../lib/creative/engine/geometry';

export interface AlignToolbarProps {
  readonly disabled: boolean;
  readonly onAlign: (mode: AlignMode) => void;
}

const ACTIONS: ReadonlyArray<{
  readonly mode: AlignMode;
  readonly labelKey: string;
  readonly Icon: typeof AlignStartHorizontal;
}> = [
  { mode: 'left', labelKey: 'studio.alignLeft', Icon: AlignStartVertical },
  { mode: 'center', labelKey: 'studio.alignCenter', Icon: AlignCenterVertical },
  { mode: 'right', labelKey: 'studio.alignRight', Icon: AlignEndVertical },
  { mode: 'top', labelKey: 'studio.alignTop', Icon: AlignStartHorizontal },
  { mode: 'middle', labelKey: 'studio.alignMiddle', Icon: AlignCenterHorizontal },
  { mode: 'bottom', labelKey: 'studio.alignBottom', Icon: AlignEndHorizontal },
];

/**
 * Alignment controls.
 *
 * With one layer selected the buttons align it to the page; with several selected
 * they align the selection to each other. Both behaviours come from the same
 * `alignSelection` command, so there is one implementation to test.
 */
export function AlignToolbar({ disabled, onAlign }: AlignToolbarProps) {
  const { t } = useTranslation();

  return (
    <div role="group" aria-label={t('studio.alignTools')} className="flex flex-wrap gap-1">
      {ACTIONS.map(({ mode, labelKey, Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onAlign(mode)}
          disabled={disabled}
          aria-label={t(labelKey)}
          title={t(labelKey)}
          className="flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 disabled:pointer-events-none disabled:opacity-40"
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
