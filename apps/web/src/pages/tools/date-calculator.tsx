import {
  addDateParts,
  dateDifference,
  describeDateParts,
  formatIsoDate,
  formatLongDate,
  parseIsoDate,
  subtractDateParts,
} from '@quickbiz/shared';
import { ArrowLeftRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ResultPanel } from '../../components/tools/result-panel';
import { SegmentedControl } from '../../components/tools/segmented-control';
import { StatGrid, StatTile } from '../../components/tools/stat-tile';
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

const MODES = [
  { value: 'difference', label: 'Between two dates' },
  { value: 'add', label: 'Add time' },
  { value: 'subtract', label: 'Subtract time' },
] as const;

type Mode = (typeof MODES)[number]['value'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function offsetIso(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function parseCount(value: string): number | null {
  if (value.trim().length === 0) return 0;
  if (!/^-?\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function DateCalculatorPage() {
  const [mode, setMode] = useState<Mode>('difference');
  const [start, setStart] = useState(todayIso);
  const [end, setEnd] = useState(() => offsetIso(30));
  const [years, setYears] = useState('0');
  const [months, setMonths] = useState('0');
  const [days, setDays] = useState('30');

  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  const yearCount = parseCount(years);
  const monthCount = parseCount(months);
  const dayCount = parseCount(days);

  const difference = useMemo(() => {
    if (!startDate || !endDate) return null;
    return dateDifference(startDate, endDate);
  }, [endDate, startDate]);

  const shifted = useMemo(() => {
    if (!startDate || yearCount === null || monthCount === null || dayCount === null) return null;
    const parts = { years: yearCount, months: monthCount, days: dayCount };
    return mode === 'subtract'
      ? subtractDateParts(startDate, parts)
      : addDateParts(startDate, parts);
  }, [dayCount, mode, monthCount, startDate, yearCount]);

  const countError =
    yearCount === null || monthCount === null || dayCount === null
      ? 'Use whole numbers for years, months and days.'
      : undefined;

  return (
    <ToolPage slug="date-calculator">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Work with dates</CardTitle>
          <CardDescription>
            Count the distance between two dates, or move a date forward or backward.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SegmentedControl
            name="date-mode"
            legend="Date calculation type"
            value={mode}
            options={MODES}
            columns={3}
            onChange={(next) => setMode(next)}
          />

          {mode === 'difference' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Start date"
                  htmlFor="date-start"
                  error={!startDate ? 'Choose a valid start date.' : undefined}
                >
                  <Input
                    id="date-start"
                    type="date"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                    aria-invalid={!startDate}
                  />
                </Field>
                <Field
                  label="End date"
                  htmlFor="date-end"
                  error={!endDate ? 'Choose a valid end date.' : undefined}
                >
                  <Input
                    id="date-end"
                    type="date"
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                    aria-invalid={!endDate}
                  />
                </Field>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStart(end);
                  setEnd(start);
                }}
              >
                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                Swap dates
              </Button>

              <ResultPanel
                label="Total difference"
                tone={difference ? 'brand' : 'neutral'}
                value={
                  difference
                    ? `${difference.totalDays} ${difference.totalDays === 1 ? 'day' : 'days'}`
                    : '\u2014'
                }
                detail={
                  difference
                    ? `${describeDateParts(difference.calendar)} between ${formatLongDate(
                        difference.earlier,
                      )} and ${formatLongDate(difference.later)}.`
                    : 'Choose both dates to see the difference.'
                }
              />

              {difference ? (
                <StatGrid>
                  <StatTile label="Weeks" value={difference.weeks} hint="full weeks" />
                  <StatTile
                    label="Days after"
                    value={difference.remainderDays}
                    hint="after full weeks"
                  />
                  <StatTile label="Weekdays" value={difference.weekdays} hint="Mon–Fri" />
                  <StatTile label="Calendar" value={describeDateParts(difference.calendar)} />
                  <StatTile label="Start" value={formatIsoDate(difference.earlier)} />
                  <StatTile label="End" value={formatIsoDate(difference.later)} />
                </StatGrid>
              ) : null}
            </>
          ) : (
            <>
              <Field
                label="Start date"
                htmlFor="date-base"
                error={!startDate ? 'Choose a valid date.' : undefined}
              >
                <Input
                  id="date-base"
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  aria-invalid={!startDate}
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Years" htmlFor="date-years" error={countError}>
                  <Input
                    id="date-years"
                    value={years}
                    onChange={(event) => setYears(event.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Months" htmlFor="date-months">
                  <Input
                    id="date-months"
                    value={months}
                    onChange={(event) => setMonths(event.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Days" htmlFor="date-days">
                  <Input
                    id="date-days"
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[7, 14, 30, 90].map((quick) => (
                  <Button
                    key={quick}
                    type="button"
                    variant={days === String(quick) ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setYears('0');
                      setMonths('0');
                      setDays(String(quick));
                    }}
                  >
                    {quick} days
                  </Button>
                ))}
              </div>

              <ResultPanel
                label={mode === 'subtract' ? 'Date before' : 'Date after'}
                tone={shifted ? 'success' : 'neutral'}
                value={shifted ? formatIsoDate(shifted) : '\u2014'}
                detail={
                  shifted
                    ? formatLongDate(shifted)
                    : 'Choose a date and whole-number amounts to move it.'
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>How the counting works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-ink-muted">
            <p>
              Days are calendar days in UTC, so the answer does not change with the time on your
              phone.
            </p>
            <p>Weekdays are Monday to Friday, counting the earlier date and not the later one.</p>
            <p>
              Adding months clamps to the end of the target month: 31 January plus one month is 28
              February.
            </p>
          </CardContent>
        </Card>

        <Alert tone="info" title="Leap years are handled">
          A 29 February start date stays correct when you add or subtract years.
        </Alert>
      </aside>
    </ToolPage>
  );
}
