import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { Layers, SlidersHorizontal, X } from 'lucide-react';
import type { CreativeNode } from '@quickbiz/shared';
import { LayersPanel } from './layers-panel';
import { PropertiesPanel } from './properties-panel';
import type { NodePatch } from '../../lib/creative/editor/use-studio-editor';
import { Button } from '../ui/button';

export interface MobileInspectorProps {
  readonly nodes: readonly CreativeNode[];
  readonly selection: readonly string[];
  readonly selected: CreativeNode | null;
  readonly onSelect: (id: string, additive: boolean) => void;
  readonly onChange: (patch: NodePatch) => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onReorder: (id: string, direction: 'forward' | 'backward') => void;
  readonly onToggleHidden: () => void;
  readonly onToggleLocked: () => void;
}

type MobileTab = 'layers' | 'properties';

/**
 * Bottom sheet for phones.
 *
 * The desktop inspector is a fixed column; on a phone it would cover the canvas,
 * so the same panels live in a sheet instead. Both tabs render the identical
 * components, so behaviour cannot diverge between screen sizes.
 */
export function MobileInspector(props: MobileInspectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<MobileTab>('properties');

  const { nodes, selection, selected, onSelect, onChange, onDuplicate, onDelete } = props;

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTab('layers');
            setOpen(true);
          }}
          aria-label={t('studio.layers')}
        >
          <Layers className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTab('properties');
            setOpen(true);
          }}
          aria-label={t('studio.properties')}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/50" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-card border-t border-border bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-border p-2">
              <div className="flex gap-1" role="tablist" aria-label={t('studio.properties')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'properties'}
                  onClick={() => setTab('properties')}
                  className={`min-h-[40px] rounded-lg px-3 text-sm font-medium ${
                    tab === 'properties' ? 'bg-primary-soft text-primary' : 'text-ink-muted'
                  }`}
                >
                  {t('studio.properties')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'layers'}
                  onClick={() => setTab('layers')}
                  className={`min-h-[40px] rounded-lg px-3 text-sm font-medium ${
                    tab === 'layers' ? 'bg-primary-soft text-primary' : 'text-ink-muted'
                  }`}
                >
                  {t('studio.layers')}
                </button>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" aria-label={t('studio.close')}>
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>

            <Dialog.Title className="sr-only">{t('studio.properties')}</Dialog.Title>
            <Dialog.Description className="sr-only">
              Edit the selected element or manage layers.
            </Dialog.Description>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'layers' ? (
                <LayersPanel
                  nodes={nodes}
                  selection={selection}
                  onSelect={onSelect}
                  onToggleHidden={props.onToggleHidden}
                  onToggleLocked={props.onToggleLocked}
                  onMove={props.onReorder}
                  onDelete={onDelete}
                />
              ) : (
                <PropertiesPanel
                  node={selected}
                  onChange={onChange}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
