import { useTranslation } from 'react-i18next';
import {
  FONT_FAMILIES,
  type CreativeColor,
  type CreativeNode,
  type CreativeShapeKind,
} from '@quickbiz/shared';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { NodePatch } from '../../lib/creative/editor/use-studio-editor';

export interface PropertiesPanelProps {
  readonly node: CreativeNode | null;
  readonly onChange: (patch: NodePatch) => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

const SWATCHES: readonly CreativeColor[] = [
  '#0B1222',
  '#FFFFFF',
  '#6741E8',
  '#1F6FE0',
  '#0F7A58',
  '#B4552D',
  '#FF5C8A',
  '#F5C451',
];

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-ink-muted">
      <span className="shrink-0">{label}</span>
      <Input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) return;
          const clamped = Math.min(Math.max(parsed, min ?? -Infinity), max ?? Infinity);
          onChange(clamped);
        }}
        className="h-9 w-24 text-right"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: CreativeColor;
  readonly onChange: (color: CreativeColor) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-0.5"
        />
        <div className="flex flex-wrap gap-1">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => onChange(swatch)}
              aria-label={`${label} ${swatch}`}
              aria-pressed={swatch.toLowerCase() === value.toLowerCase()}
              className="size-6 rounded-md border border-border-strong"
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-ink-muted">
      <span className="shrink-0">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2 text-sm text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Property inspector.
 *
 * Shows only fields the selected node actually has, so a text layer never offers a
 * fill colour and an image never offers a font. Every change is a document
 * command and therefore undoable.
 */
export function PropertiesPanel({ node, onChange, onDuplicate, onDelete }: PropertiesPanelProps) {
  const { t } = useTranslation();

  if (!node) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-ink">{t('studio.properties')}</h2>
        <p className="mt-3 text-sm font-medium text-ink">{t('studio.nothingSelected')}</p>
        <p className="mt-1 text-sm text-ink-muted">{t('studio.nothingSelectedBody')}</p>
      </div>
    );
  }

  const actions = (
    <div className="flex items-center gap-2 border-t border-border p-3">
      <Button variant="outline" size="sm" onClick={onDuplicate} className="flex-1">
        {t('studio.duplicate')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="flex-1 text-danger hover:bg-danger-soft"
      >
        {t('studio.remove')}
      </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <input
          value={node.name}
          aria-label={t('studio.name')}
          onChange={(event) => onChange({ name: event.target.value.slice(0, 80) })}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-ink hover:border-border focus-visible:border-primary focus-visible:outline-none"
        />
        <span className="shrink-0 rounded bg-surface-muted px-2 py-0.5 text-xs text-ink-subtle">
          {node.type}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t('studio.position')}
          </h3>
          <NumberField label="X" value={node.x} onChange={(x) => onChange({ x } as NodePatch)} />
          <NumberField label="Y" value={node.y} onChange={(y) => onChange({ y } as NodePatch)} />
          <NumberField
            label={t('studio.width')}
            value={node.width}
            min={1}
            onChange={(width) => onChange({ width } as NodePatch)}
          />
          <NumberField
            label={t('studio.height')}
            value={node.height}
            min={1}
            onChange={(height) => onChange({ height } as NodePatch)}
          />
          <NumberField
            label={t('studio.rotation')}
            value={node.rotation}
            min={-360}
            max={360}
            onChange={(rotation) => onChange({ rotation })}
          />
          <NumberField
            label={t('studio.opacity')}
            value={node.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(opacity) => onChange({ opacity })}
          />
        </section>

        {node.type === 'text' ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t('studio.text')}
            </h3>
            <textarea
              value={node.text}
              rows={3}
              aria-label={t('studio.text')}
              onChange={(event) => onChange({ text: event.target.value.slice(0, 5_000) })}
              className="w-full rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35"
            />
            <SelectField
              label={t('studio.font')}
              value={node.fontFamily}
              options={FONT_FAMILIES.map((family) => ({ value: family.id, label: family.label }))}
              onChange={(fontFamily) => onChange({ fontFamily })}
            />
            <NumberField
              label={t('studio.size')}
              value={node.fontSize}
              min={4}
              max={400}
              onChange={(fontSize) => onChange({ fontSize })}
            />
            <SelectField
              label={t('studio.weight')}
              value={String(node.fontWeight) as '400' | '500' | '600' | '700' | '800'}
              options={[
                { value: '400', label: 'Regular' },
                { value: '500', label: 'Medium' },
                { value: '600', label: 'Semibold' },
                { value: '700', label: 'Bold' },
                { value: '800', label: 'Extra bold' },
              ]}
              onChange={(weight) => onChange({ fontWeight: Number(weight) as 400 })}
            />
            <SelectField
              label={t('studio.align')}
              value={node.align}
              options={[
                { value: 'left', label: t('studio.alignLeft') },
                { value: 'center', label: t('studio.alignCenter') },
                { value: 'right', label: t('studio.alignRight') },
              ]}
              onChange={(align) => onChange({ align })}
            />
            <div className="flex gap-2">
              <Button
                variant={node.italic ? 'primary' : 'outline'}
                size="sm"
                aria-pressed={node.italic}
                onClick={() => onChange({ italic: !node.italic })}
                className="flex-1"
              >
                <em>Italic</em>
              </Button>
              <Button
                variant={node.underline ? 'primary' : 'outline'}
                size="sm"
                aria-pressed={node.underline}
                onClick={() => onChange({ underline: !node.underline })}
                className="flex-1"
              >
                <span className="underline">Underline</span>
              </Button>
            </div>
            <NumberField
              label={t('studio.lineHeight')}
              value={node.lineHeight}
              min={0.8}
              max={2.5}
              step={0.05}
              onChange={(lineHeight) => onChange({ lineHeight })}
            />
            <NumberField
              label={t('studio.letterSpacing')}
              value={node.letterSpacing}
              min={-10}
              max={40}
              step={0.5}
              onChange={(letterSpacing) => onChange({ letterSpacing })}
            />
            <ColorField
              label={t('studio.color')}
              value={node.color}
              onChange={(color) => onChange({ color })}
            />
          </section>
        ) : null}

        {node.type === 'shape' ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t('studio.shape')}
            </h3>
            <SelectField
              label={t('studio.shape')}
              value={node.shape}
              options={(
                [
                  'rect',
                  'roundRect',
                  'ellipse',
                  'line',
                  'arrow',
                  'triangle',
                  'star',
                ] as CreativeShapeKind[]
              ).map((shape) => ({ value: shape, label: shape }))}
              onChange={(shape) => onChange({ shape })}
            />
            <ColorField
              label={t('studio.fill')}
              value={node.fill.type === 'solid' ? node.fill.color : '#FFFFFF'}
              onChange={(color) => onChange({ fill: { type: 'solid', color } })}
            />
            <NumberField
              label={t('studio.corner')}
              value={node.cornerRadius}
              min={0}
              max={1_000}
              onChange={(cornerRadius) => onChange({ cornerRadius })}
            />
            <ColorField
              label={t('studio.stroke')}
              value={node.stroke?.color ?? '#0B1222'}
              onChange={(color) =>
                onChange({
                  stroke: {
                    color,
                    width: node.stroke?.width ?? 2,
                    style: node.stroke?.style ?? 'solid',
                  },
                })
              }
            />
            <NumberField
              label={`${t('studio.stroke')} ${t('studio.size').toLowerCase()}`}
              value={node.stroke?.width ?? 0}
              min={0}
              max={200}
              onChange={(width) =>
                onChange({
                  stroke: {
                    color: node.stroke?.color ?? '#0B1222',
                    width,
                    style: node.stroke?.style ?? 'solid',
                  },
                })
              }
            />
          </section>
        ) : null}

        {node.type === 'image' ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t('studio.images')}
            </h3>
            <SelectField
              label={t('studio.fit')}
              value={node.fit}
              options={[
                { value: 'cover', label: t('studio.cover') },
                { value: 'contain', label: t('studio.contain') },
              ]}
              onChange={(fit) => onChange({ fit })}
            />
            <NumberField
              label={`${t('studio.crop')} X`}
              value={node.crop.x}
              min={0}
              max={0.99}
              step={0.01}
              onChange={(x) =>
                onChange({ crop: { ...node.crop, x, width: Math.min(node.crop.width, 1 - x) } })
              }
            />
            <NumberField
              label={`${t('studio.crop')} Y`}
              value={node.crop.y}
              min={0}
              max={0.99}
              step={0.01}
              onChange={(y) =>
                onChange({ crop: { ...node.crop, y, height: Math.min(node.crop.height, 1 - y) } })
              }
            />
            <NumberField
              label={`${t('studio.crop')} ${t('studio.width')}`}
              value={node.crop.width}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(width) =>
                onChange({ crop: { ...node.crop, width: Math.min(width, 1 - node.crop.x) } })
              }
            />
            <NumberField
              label={`${t('studio.crop')} ${t('studio.height')}`}
              value={node.crop.height}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(height) =>
                onChange({ crop: { ...node.crop, height: Math.min(height, 1 - node.crop.y) } })
              }
            />
          </section>
        ) : null}
      </div>

      {actions}
    </div>
  );
}
