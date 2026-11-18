import {
  formatDecimal,
  parseDecimalInput,
  percentageChange,
  percentageDifference,
  percentOf,
  roundTo,
  whatPercent,
} from '@quickbiz/shared';
import { useMemo, useState } from 'react';
import { ResultPanel } from '../../components/tools/result-panel';
import { SegmentedControl } from '../../components/tools/segmented-control';
import { ToolPage } from '../../components/tools/tool-page';
import { Alert } from '../../components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';

const MODES = [
  { value: 'percent-of', label: 'Share of a value' },
  { value: 'what-percent', label: 'One value as a %' },
  { value: 'change', label: 'Increase or decrease' },
  { value: 'difference', label: 'Difference' },
] as const;

type Mode = (typeof MODES)[number]['value'];

interface ModeCopy {
  readonly question: string;
  readonly first: string;
  readonly firstHint: string;
  readonly second: string;
  readonly secondHint: string;
}

const MODE_COPY: Readonly<Record<Mode, ModeCopy>> = {
  'percent-of': {
    question: 'What is a percentage of a value?',
    first: 'Percentage',
    firstHint: 'For example 15 for 15%.',
    second: 'Value',
    secondHint: 'The amount you are taking a share of.',
  },
  'what-percent': {
    question: 'One value is what percentage of another?',
    first: 'Part',
    firstHint: 'The smaller or partial amount.',
    second: 'Whole',
    secondHint: 'The total it belongs to.',
  },
  change: {
    question: 'How much did a value increase or decrease?',
    first: 'Starting value',
    firstHint: 'The value before the change.',
    second: 'New value',
    secondHint: 'The value after the change.',
  },
  difference: {
    question: 'How far apart are two values, in percent?',
    first: 'First value',
    firstHint: 'Either value; the order does not matter.',
    second: 'Second value',
    secondHint: 'The other value being compared.',
  },
};

interface Outcome {
  readonly value: string;
  readonly detail: string;
  readonly tone: 'brand' | 'success' | 'neutral';
}

export function PercentageCalculatorPage() {
  const [mode, setMode] = useState<Mode>('percent-of');
  const [first, setFirst] = useState('15');
  const [second, setSecond] = useState('200');

  const copy = MODE_COPY[mode];
  const a = parseDecimalInput(first);
  const b = parseDecimalInput(second);
  const invalidFirst = first.trim().length > 0 && a === null;
  const invalidSecond = second.trim().length > 0 && b === null;

  const outcome = useMemo<Outcome | null>(() => {
    if (a === null || b === null) return null;

    if (mode === 'percent-of') {
      const result = percentOf(b, a);
      return {
        value: formatDecimal(result),
        detail: `${formatDecimal(a)}% of ${formatDecimal(b)} is ${formatDecimal(result)}.`,
        tone: 'brand',
      };
    }

    if (mode === 'what-percent') {
      const result = whatPercent(a, b);
      if (result === null) {
        return {
          value: 'Not defined',
          detail: 'The whole is zero, so a percentage of it cannot be calculated.',
          tone: 'neutral',
        };
      }
      return {
        value: `${formatDecimal(roundTo(result, 4))}%`,
        detail: `${formatDecimal(a)} is ${formatDecimal(roundTo(result, 4))}% of ${formatDecimal(b)}.`,
        tone: 'brand',
      };
    }

    if (mode === 'change') {
      const change = percentageChange(a, b);
      if (change === null) {
        return {
          value: 'Not defined',
          detail: 'A change from zero has no percentage base. Use the difference mode instead.',
          tone: 'neutral',
        };
      }
      if (change.direction === 'unchanged') {
        return { value: '0%', detail: 'The value has not changed.', tone: 'neutral' };
      }
      const magnitude = formatDecimal(roundTo(Math.abs(change.percent), 4));
      return {
        value: `${magnitude}%`,
        detail: `${change.direction === 'increase' ? 'Increase' : 'Decrease'} of ${formatDecimal(
          roundTo(Math.abs(change.difference), 4),
        )}, from ${formatDecimal(a)} to ${formatDecimal(b)}.`,
        tone: change.direction === 'increase' ? 'success' : 'brand',
      };
    }

    const result = percentageDifference(a, b);
    if (result === null) {
      return {
        value: 'Not defined',
        detail: 'The average of the two values is zero, so there is no base for a percentage.',
        tone: 'neutral',
      };
    }
    return {
      value: `${formatDecimal(roundTo(result, 4))}%`,
      detail: `Measured against the average of ${formatDecimal(roundTo((a + b) / 2, 4))}.`,
      tone: 'brand',
    };
  }, [a, b, mode]);

  const reference = useMemo(() => {
    if (b === null) return null;
    return [5, 10, 15, 20, 25].map((percent) => ({
      percent,
      value: formatDecimal(percentOf(b, percent)),
    }));
  }, [b]);

  return (
    <ToolPage slug="percentage-calculator">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>What do you want to work out?</CardTitle>
          <CardDescription>{copy.question}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SegmentedControl
            name="percentage-mode"
            legend="Percentage calculation type"
            value={mode}
            options={MODES}
            onChange={(next) => setMode(next)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={copy.first}
              htmlFor="percentage-first"
              hint={copy.firstHint}
              error={invalidFirst ? 'Enter a number, for example 15.' : undefined}
            >
              <Input
                id="percentage-first"
                value={first}
                onChange={(event) => setFirst(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={invalidFirst}
                aria-describedby="percentage-first-hint"
              />
            </Field>

            <Field
              label={copy.second}
              htmlFor="percentage-second"
              hint={copy.secondHint}
              error={invalidSecond ? 'Enter a number, for example 200.' : undefined}
            >
              <Input
                id="percentage-second"
                value={second}
                onChange={(event) => setSecond(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={invalidSecond}
                aria-describedby="percentage-second-hint"
              />
            </Field>
          </div>

          <ResultPanel
            label="Result"
            tone={outcome?.tone ?? 'neutral'}
            value={outcome?.value ?? '\u2014'}
            detail={outcome?.detail ?? 'Enter both values to see the answer.'}
          />
        </CardContent>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Quick reference</CardTitle>
            <CardDescription>
              {reference
                ? 'Common shares of the second value.'
                : 'Enter the second value to see common shares of it.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reference ? (
              <dl className="divide-y divide-border">
                {reference.map((entry) => (
                  <div key={entry.percent} className="flex items-baseline justify-between py-2">
                    <dt className="text-sm text-ink-muted">{entry.percent}%</dt>
                    <dd className="font-mono text-sm font-medium tabular-nums text-ink">
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3.5 py-6 text-center text-sm text-ink-subtle">
                Nothing to show yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Alert tone="info" title="Two percentages, two meanings">
          <p>
            A change from 40% to 46% is <strong>6 percentage points</strong>, but a{' '}
            <strong>15% relative increase</strong>. Use “Increase or decrease” for money and
            “Difference” for comparing two figures fairly.
          </p>
        </Alert>
      </aside>
    </ToolPage>
  );
}
