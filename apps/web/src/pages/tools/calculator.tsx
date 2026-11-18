import { evaluateExpression, formatDecimal, roundTo, type ExpressionError } from '@quickbiz/shared';
import { Delete, History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ToolPage } from '../../components/tools/tool-page';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/cn';

const ERROR_COPY: Readonly<Record<ExpressionError, string>> = {
  empty: 'Enter a calculation first.',
  'too-long': 'That expression is too long. Keep it under 240 characters.',
  'invalid-character': 'Only numbers, + − × ÷, brackets and % can be used.',
  'unexpected-token': 'That expression is unfinished, or an operator is in the wrong place.',
  'unbalanced-parenthesis': 'A bracket is missing.',
  'division-by-zero': 'Division by zero is not defined.',
  'not-finite': 'That result is too large to display.',
  'too-deep': 'Too many nested brackets.',
};

const KEYPAD: readonly (readonly string[])[] = [
  ['C', '(', ')', '\u00f7'],
  ['7', '8', '9', '\u00d7'],
  ['4', '5', '6', '\u2212'],
  ['1', '2', '3', '+'],
  ['%', '0', '.', '='],
];

interface HistoryEntry {
  readonly expression: string;
  readonly value: string;
}

function toExpressionString(value: number): string {
  const rounded = roundTo(value, 10);
  return Math.abs(rounded) >= 1e15 ? rounded.toFixed(0) : String(rounded);
}

export function CalculatorPage() {
  const [expression, setExpression] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly HistoryEntry[]>([]);

  const preview = useMemo(() => {
    if (expression.trim().length === 0) return null;
    return evaluateExpression(expression);
  }, [expression]);

  const previewText =
    preview === null
      ? '\u2014'
      : preview.ok
        ? formatDecimal(preview.value)
        : 'Check the expression';

  function append(token: string): void {
    setError(null);
    setExpression((current) => `${current}${token}`);
  }

  function clear(): void {
    setError(null);
    setExpression('');
  }

  function backspace(): void {
    setError(null);
    setExpression((current) => Array.from(current).slice(0, -1).join(''));
  }

  function evaluate(): void {
    const result = evaluateExpression(expression);
    if (!result.ok) {
      setError(ERROR_COPY[result.error]);
      return;
    }

    setHistory((current) =>
      [{ expression, value: formatDecimal(result.value) }, ...current].slice(0, 6),
    );
    setExpression(toExpressionString(result.value));
    setError(null);
  }

  function handleKey(key: string): void {
    if (key === 'C') {
      clear();
      return;
    }
    if (key === '=') {
      evaluate();
      return;
    }
    append(key);
  }

  return (
    <ToolPage slug="calculator">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Calculation</CardTitle>
          <CardDescription>
            Type an expression or use the keypad. Percent divides by 100, so 200 × 10% is 20.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              evaluate();
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="calculator-expression" className="sr-only">
                Calculation
              </label>
              <Input
                id="calculator-expression"
                value={expression}
                onChange={(event) => {
                  setError(null);
                  setExpression(event.target.value);
                }}
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="0"
                aria-invalid={error !== null}
                aria-describedby="calculator-preview"
                className="h-16 rounded-xl border-border-strong bg-surface-muted/60 px-4 text-right font-mono text-2xl tabular-nums sm:text-3xl"
              />
            </div>

            <div
              id="calculator-preview"
              className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5"
              role="status"
              aria-live="polite"
            >
              <span className="text-xs font-medium uppercase tracking-[0.1em] text-ink-subtle">
                Result
              </span>
              <span
                className={cn(
                  'break-all text-right font-mono text-lg tabular-nums',
                  preview?.ok ? 'text-ink' : 'text-ink-subtle',
                )}
              >
                {previewText}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {KEYPAD.flat().map((key, index) => {
                const isEquals = key === '=';
                const isOperator = ['\u00f7', '\u00d7', '\u2212', '+'].includes(key);
                const isUtility = key === 'C';

                return (
                  <Button
                    key={`${key}-${index}`}
                    type={isEquals ? 'submit' : 'button'}
                    variant={
                      isEquals
                        ? 'primary'
                        : isUtility
                          ? 'ghost'
                          : isOperator
                            ? 'secondary'
                            : 'outline'
                    }
                    className="h-12 text-base font-medium"
                    onClick={isEquals ? undefined : () => handleKey(key)}
                    aria-label={isEquals ? 'Equals' : `Insert ${key}`}
                  >
                    {key}
                  </Button>
                );
              })}
            </div>
          </form>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-subtle">Enter evaluates. Long expressions are fine.</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={backspace}
              disabled={expression.length === 0}
            >
              <Delete className="size-3.5" aria-hidden="true" />
              Backspace
            </Button>
          </div>

          {error ? (
            <Alert tone="danger" title="This cannot be calculated">
              {error}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <History className="size-4 text-ink-subtle" aria-hidden="true" />
              <CardTitle>Recent results</CardTitle>
            </div>
            <CardDescription>Kept in this tab only. Closing the page clears them.</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3.5 py-6 text-center text-sm text-ink-subtle">
                Finished calculations appear here. Press = to start the list.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((entry, index) => (
                  <li key={`${entry.expression}-${index}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setExpression(entry.expression);
                        setError(null);
                      }}
                      className="flex w-full items-baseline justify-between gap-3 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-surface-muted"
                    >
                      <span className="min-w-0 truncate font-mono text-xs text-ink-subtle">
                        {entry.expression}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-medium tabular-nums text-ink">
                        {entry.value}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {history.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                onClick={() => setHistory([])}
              >
                Clear history
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Works like a real calculator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ink-muted">
            <p>Precedence is standard: × and ÷ before + and −.</p>
            <p>Brackets group any part of the expression.</p>
            <p>Tap a previous result to put it back in the display.</p>
          </CardContent>
        </Card>
      </aside>
    </ToolPage>
  );
}
