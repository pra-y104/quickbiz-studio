import { cn } from '../../lib/cn';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Unique radio group name; also used to build element ids. */
  readonly name: string;
  /** Accessible group label, visually hidden. */
  readonly legend: string;
  readonly value: T;
  readonly options: readonly SegmentedOption<T>[];
  readonly onChange: (value: T) => void;
  readonly columns?: 2 | 3 | 4;
}

/**
 * Segmented choice built from real radio inputs.
 *
 * Native radios give keyboard support, grouping and screen-reader semantics for
 * free; the labels carry the pill styling. No JavaScript keyboard handling is
 * needed, which keeps the control reliable on Android.
 */
export function SegmentedControl<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  columns = 2,
}: SegmentedControlProps<T>) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div
        className={cn(
          'grid gap-1.5 rounded-xl border border-border bg-surface-muted p-1.5',
          columns === 2 && 'grid-cols-2',
          columns === 3 && 'grid-cols-3',
          columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const selected = option.value === value;
          return (
            <div key={option.value}>
              <input
                type="radio"
                id={id}
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-medium',
                  'transition-colors duration-150',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-focus/70 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-surface-muted',
                  selected
                    ? 'bg-surface text-ink shadow-elev-1'
                    : 'text-ink-muted hover:bg-surface/70 hover:text-ink',
                )}
              >
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
