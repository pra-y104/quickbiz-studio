import {
  UNIT_CATEGORIES,
  convertUnit,
  formatConvertedValue,
  getUnit,
  getUnitCategory,
  isBelowAbsoluteZero,
  parseDecimalInput,
  type UnitCategoryId,
} from '@quickbiz/shared';
import { ArrowDownUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ResultPanel } from '../../components/tools/result-panel';
import { SegmentedControl } from '../../components/tools/segmented-control';
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
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';

const CATEGORY_OPTIONS = UNIT_CATEGORIES.map((category) => ({
  value: category.id,
  label: category.name,
}));

export function UnitConverterPage() {
  const [categoryId, setCategoryId] = useState<UnitCategoryId>('length');
  const [amount, setAmount] = useState('1');
  const [from, setFrom] = useState(UNIT_CATEGORIES[0]?.defaultFrom ?? 'm');
  const [to, setTo] = useState(UNIT_CATEGORIES[0]?.defaultTo ?? 'ft');

  const category = getUnitCategory(categoryId);
  const value = parseDecimalInput(amount);
  const invalidAmount = amount.trim().length > 0 && value === null;
  const belowZero =
    categoryId === 'temperature' && value !== null && isBelowAbsoluteZero(value, from);

  const result = useMemo(() => {
    if (value === null || belowZero) return null;
    return convertUnit(categoryId, from, to, value);
  }, [belowZero, categoryId, from, to, value]);

  const fromUnit = getUnit(categoryId, from);
  const toUnit = getUnit(categoryId, to);

  function changeCategory(next: UnitCategoryId): void {
    const nextCategory = getUnitCategory(next);
    setCategoryId(next);
    setFrom(nextCategory.defaultFrom);
    setTo(nextCategory.defaultTo);
  }

  function swap(): void {
    setFrom(to);
    setTo(from);
  }

  const reference = useMemo(() => {
    const base = value ?? 1;
    if (belowZero) return [];
    return category.units
      .filter((unit) => unit.id !== from)
      .map((unit) => ({
        unit,
        converted: convertUnit(categoryId, from, unit.id, base),
      }));
  }, [belowZero, category.units, categoryId, from, value]);

  return (
    <ToolPage slug="unit-converter">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Convert a measurement</CardTitle>
          <CardDescription>{category.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SegmentedControl
            name="unit-category"
            legend="Measurement category"
            value={categoryId}
            options={CATEGORY_OPTIONS}
            columns={3}
            onChange={(next) => changeCategory(next as UnitCategoryId)}
          />

          <Field
            label="Amount"
            htmlFor="unit-amount"
            hint="Decimals and thousands separators are accepted."
            error={invalidAmount ? 'Enter a number, for example 12.5.' : undefined}
          >
            <Input
              id="unit-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={invalidAmount}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="unit-from">From</Label>
              <Select id="unit-from" value={from} onChange={(event) => setFrom(event.target.value)}>
                {category.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.symbol})
                  </option>
                ))}
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={swap}
              aria-label="Swap the two units"
              className="h-10 sm:mb-0"
            >
              <ArrowDownUp className="size-4" aria-hidden="true" />
              <span className="sm:hidden">Swap units</span>
            </Button>

            <div className="space-y-1.5">
              <Label htmlFor="unit-to">To</Label>
              <Select id="unit-to" value={to} onChange={(event) => setTo(event.target.value)}>
                {category.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.symbol})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {belowZero ? (
            <Alert tone="danger" title="Below absolute zero">
              Temperature cannot go below 0 K. Check the value and the unit.
            </Alert>
          ) : null}

          <ResultPanel
            label="Converted value"
            tone={result === null ? 'neutral' : 'brand'}
            value={result === null ? '\u2014' : `${formatConvertedValue(result)} ${toUnit.symbol}`}
            detail={
              result === null || value === null
                ? 'Enter an amount to convert it.'
                : `${formatConvertedValue(value)} ${fromUnit.symbol} = ${formatConvertedValue(
                    result,
                  )} ${toUnit.symbol}`
            }
          />

          {category.note ? (
            <p className="text-xs leading-relaxed text-ink-subtle">{category.note}</p>
          ) : null}
        </CardContent>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              {value === null ? '1 ' : `${formatConvertedValue(value)} `}
              {fromUnit.symbol} in other units
            </CardTitle>
            <CardDescription>Same amount, every unit in this category.</CardDescription>
          </CardHeader>
          <CardContent>
            {reference.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3.5 py-6 text-center text-sm text-ink-subtle">
                Enter a valid amount to compare units.
              </p>
            ) : (
              <dl className="divide-y divide-border">
                {reference.map((entry) => (
                  <div
                    key={entry.unit.id}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <dt className="text-sm text-ink-muted">
                      {entry.unit.name}
                      <span className="ml-1 text-ink-subtle">({entry.unit.symbol})</span>
                    </dt>
                    <dd className="shrink-0 font-mono text-sm font-medium tabular-nums text-ink">
                      {formatConvertedValue(entry.converted)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </aside>
    </ToolPage>
  );
}
