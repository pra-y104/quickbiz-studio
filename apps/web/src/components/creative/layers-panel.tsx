import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Trash2 } from 'lucide-react';
import type { CreativeNode } from '@quickbiz/shared';
import { Button } from '../ui/button';

export interface LayersPanelProps {
  readonly nodes: readonly CreativeNode[];
  readonly selection: readonly string[];
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onToggleHidden: (id: string) => void;
  readonly onToggleLocked: (id: string) => void;
  readonly onMove: (id: string, direction: 'forward' | 'backward') => void;
  readonly onDelete: (id: string) => void;
}

function iconFor(node: CreativeNode) {
  switch (node.type) {
    case 'text':
      return 'T';
    case 'image':
      return '▣';
    case 'group':
      return '⬚';
    default:
      return node.shape === 'ellipse' ? '●' : '■';
  }
}

/**
 * Layer list.
 *
 * Ordered back-to-front, matching the renderer. Reordering, locking and hiding
 * are ordinary document commands, so they appear in undo history like any other
 * edit.
 */
export function LayersPanel(props: LayersPanelProps) {
  const { t } = useTranslation();
  const { nodes, selection, onSelect, onToggleHidden, onToggleLocked, onMove, onDelete } = props;

  if (nodes.length === 0) {
    return (
      <p className="p-4 text-sm text-ink-muted">
        Add text, a shape or an image and it will appear here as a layer.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {[...nodes].reverse().map((node) => {
        const selected = selection.includes(node.id);
        return (
          <li key={node.id}>
            <div
              className={`flex items-center gap-2 px-2 py-1.5 ${
                selected ? 'bg-primary-soft' : 'hover:bg-surface-muted'
              }`}
            >
              <button
                type="button"
                onClick={(event) =>
                  onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)
                }
                aria-pressed={selected}
                className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
              >
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded bg-surface-muted text-xs font-semibold text-ink-muted"
                >
                  {iconFor(node)}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    node.hidden ? 'text-ink-subtle line-through' : 'text-ink'
                  }`}
                >
                  {node.name}
                </span>
              </button>

              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => onToggleLocked(node.id)}
                  aria-label={node.locked ? t('studio.unlock') : t('studio.lock')}
                  className="flex size-9 items-center justify-center rounded-md text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
                >
                  {node.locked ? (
                    <Lock className="size-4" aria-hidden="true" />
                  ) : (
                    <LockOpen className="size-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleHidden(node.id)}
                  aria-label={node.hidden ? t('studio.show') : t('studio.hide')}
                  className="flex size-9 items-center justify-center rounded-md text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
                >
                  {node.hidden ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onMove(node.id, 'forward')}
                  aria-label={t('studio.forward')}
                  className="hidden size-9 items-center justify-center rounded-md text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 sm:flex"
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(node.id, 'backward')}
                  aria-label={t('studio.backward')}
                  className="hidden size-9 items-center justify-center rounded-md text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 sm:flex"
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(node.id)}
                  aria-label={t('studio.remove')}
                  className="flex size-9 items-center justify-center rounded-md text-ink-subtle hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface InspectorHeaderProps {
  readonly title: string;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly canEdit: boolean;
}

export function InspectorHeader({ title, onDuplicate, onDelete, canEdit }: InspectorHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border p-3">
      <p className="min-w-0 truncate text-sm font-semibold text-ink">{title}</p>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onDuplicate} disabled={!canEdit}>
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={!canEdit}
          className="text-danger"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
