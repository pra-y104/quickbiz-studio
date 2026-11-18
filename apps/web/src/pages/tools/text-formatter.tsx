import {
  TEXT_GROUP_LABELS,
  TEXT_TRANSFORMATIONS,
  TEXT_TRANSFORM_GROUPS,
  applyTransformations,
  type TextTransformGroup,
} from '@quickbiz/shared';
import { Download, Eraser } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CopyButton } from '../../components/tools/copy-button';
import { ToolPage } from '../../components/tools/tool-page';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../lib/cn';
import { downloadText } from '../../lib/tools/download';

const PLACEHOLDER =
  'Paste text here, then choose one or more operations. Nothing is uploaded and nothing is saved.';

export function TextFormatterPage() {
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<readonly string[]>([]);

  const ordered = useMemo(
    () =>
      TEXT_TRANSFORMATIONS.filter((transformation) => selected.includes(transformation.id)).map(
        (transformation) => transformation.id,
      ),
    [selected],
  );

  const output = useMemo(() => applyTransformations(input, ordered), [input, ordered]);
  const hasInput = input.length > 0;
  const hasOperations = ordered.length > 0;
  const changed = output !== input;

  function toggle(id: string): void {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  return (
    <ToolPage slug="text-formatter">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Your text</CardTitle>
          <CardDescription>{PLACEHOLDER}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="text-formatter-input" className="sr-only">
            Text to format
          </Label>
          <Textarea
            id="text-formatter-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={12}
            placeholder={'the QUICK brown fox\njumped  over   the lazy dog'}
            className="min-h-[15rem]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
            <span>{input.length} characters in</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput('');
                setSelected([]);
              }}
              disabled={!hasInput && !hasOperations}
            >
              <Eraser className="size-3.5" aria-hidden="true" />
              Clear everything
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle>Operations</CardTitle>
              <CardDescription>
                {hasOperations
                  ? `${ordered.length} operation${ordered.length === 1 ? '' : 's'} applied in catalogue order.`
                  : 'Tap any operation; combinations stack from top to bottom.'}
              </CardDescription>
            </div>
            {hasOperations ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear selection
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {TEXT_TRANSFORM_GROUPS.map((group) => (
            <fieldset key={group}>
              <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                {TEXT_GROUP_LABELS[group as TextTransformGroup]}
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TEXT_TRANSFORMATIONS.filter((entry) => entry.group === group).map(
                  (transformation) => {
                    const active = selected.includes(transformation.id);
                    return (
                      <label key={transformation.id} className="cursor-pointer">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={active}
                          onChange={() => toggle(transformation.id)}
                        />
                        <span
                          className={cn(
                            'flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                            'peer-focus-visible:ring-2 peer-focus-visible:ring-focus/70 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-canvas',
                            active
                              ? 'border-primary bg-primary-soft text-primary'
                              : 'border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink',
                          )}
                          title={transformation.description}
                        >
                          {transformation.label}
                        </span>
                      </label>
                    );
                  },
                )}
              </div>
            </fieldset>
          ))}
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1.5">
                <CardTitle>Result</CardTitle>
                <CardDescription>
                  {!hasInput
                    ? 'Add text to see the formatted version.'
                    : !hasOperations
                      ? 'Choose an operation to change the text.'
                      : changed
                        ? 'Ready to copy or download.'
                        : 'The text already matches this selection.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="text-formatter-output" className="sr-only">
              Formatted text
            </Label>
            <Textarea
              id="text-formatter-output"
              value={output}
              readOnly
              rows={12}
              className="min-h-[15rem] bg-surface-muted/50"
              aria-live="polite"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-subtle">{output.length} characters out</span>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={output} label="Copy result" disabled={!changed} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadText(output, 'formatted-text.txt')}
                  disabled={!hasInput || !changed}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download .txt
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Before you paste it somewhere important</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-ink-muted">
            <p>Title Case capitalises every word, including short joining words.</p>
            <p>“Strip HTML” removes tags; keep a copy if you may need the markup again.</p>
            <p>
              Sorting and de-duplicating lines reorder content — useful for lists, wrong for prose.
            </p>
          </CardContent>
        </Card>
      </aside>
    </ToolPage>
  );
}
