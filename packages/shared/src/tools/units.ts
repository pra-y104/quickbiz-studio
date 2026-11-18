/**
 * Unit conversion tables.
 *
 * Linear categories store a factor to their base unit (metre, kilogram, litre,
 * second). Temperature is affine and is handled separately, because `0 °C` is
 * not `0` of anything.
 *
 * Time deliberately stops at weeks: months and years have no fixed length, so
 * offering them here would produce answers that are wrong about a third of the
 * time. The date calculator handles calendar units properly.
 */

export const UNIT_CATEGORY_IDS = ['length', 'mass', 'temperature', 'volume', 'time'] as const;

export type UnitCategoryId = (typeof UNIT_CATEGORY_IDS)[number];

export interface UnitDefinition {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
}

export interface UnitCategory {
  readonly id: UnitCategoryId;
  readonly name: string;
  readonly description: string;
  readonly units: readonly UnitDefinition[];
  readonly defaultFrom: string;
  readonly defaultTo: string;
  /** Shown under the inputs when a category needs a caveat. */
  readonly note?: string;
}

export const UNIT_CATEGORIES: readonly UnitCategory[] = [
  {
    id: 'length',
    name: 'Length',
    description: 'Distance and size, from millimetres to miles.',
    defaultFrom: 'm',
    defaultTo: 'ft',
    units: [
      { id: 'mm', name: 'Millimetre', symbol: 'mm' },
      { id: 'cm', name: 'Centimetre', symbol: 'cm' },
      { id: 'm', name: 'Metre', symbol: 'm' },
      { id: 'km', name: 'Kilometre', symbol: 'km' },
      { id: 'in', name: 'Inch', symbol: 'in' },
      { id: 'ft', name: 'Foot', symbol: 'ft' },
      { id: 'yd', name: 'Yard', symbol: 'yd' },
      { id: 'mi', name: 'Mile', symbol: 'mi' },
    ],
  },
  {
    id: 'mass',
    name: 'Weight',
    description: 'Everyday mass and weight, metric and imperial.',
    defaultFrom: 'kg',
    defaultTo: 'lb',
    units: [
      { id: 'mg', name: 'Milligram', symbol: 'mg' },
      { id: 'g', name: 'Gram', symbol: 'g' },
      { id: 'kg', name: 'Kilogram', symbol: 'kg' },
      { id: 't', name: 'Metric tonne', symbol: 't' },
      { id: 'oz', name: 'Ounce', symbol: 'oz' },
      { id: 'lb', name: 'Pound', symbol: 'lb' },
      { id: 'st', name: 'Stone', symbol: 'st' },
    ],
  },
  {
    id: 'temperature',
    name: 'Temperature',
    description: 'Celsius, Fahrenheit and Kelvin.',
    defaultFrom: 'c',
    defaultTo: 'f',
    units: [
      { id: 'c', name: 'Celsius', symbol: '°C' },
      { id: 'f', name: 'Fahrenheit', symbol: '°F' },
      { id: 'k', name: 'Kelvin', symbol: 'K' },
    ],
    note: 'Kelvin cannot go below absolute zero (0 K).',
  },
  {
    id: 'volume',
    name: 'Volume',
    description: 'Liquids and capacity, metric and US customary.',
    defaultFrom: 'l',
    defaultTo: 'gal',
    units: [
      { id: 'ml', name: 'Millilitre', symbol: 'mL' },
      { id: 'l', name: 'Litre', symbol: 'L' },
      { id: 'm3', name: 'Cubic metre', symbol: 'm³' },
      { id: 'tsp', name: 'Teaspoon (US)', symbol: 'tsp' },
      { id: 'tbsp', name: 'Tablespoon (US)', symbol: 'tbsp' },
      { id: 'cup', name: 'Cup (US)', symbol: 'cup' },
      { id: 'floz', name: 'Fluid ounce (US)', symbol: 'fl oz' },
      { id: 'pint', name: 'Pint (US)', symbol: 'pt' },
      { id: 'quart', name: 'Quart (US)', symbol: 'qt' },
      { id: 'gal', name: 'Gallon (US)', symbol: 'gal' },
    ],
    note: 'Volumes use US customary measures, not imperial pints or gallons.',
  },
  {
    id: 'time',
    name: 'Time',
    description: 'Seconds through weeks.',
    defaultFrom: 'h',
    defaultTo: 'min',
    units: [
      { id: 'ms', name: 'Millisecond', symbol: 'ms' },
      { id: 's', name: 'Second', symbol: 's' },
      { id: 'min', name: 'Minute', symbol: 'min' },
      { id: 'h', name: 'Hour', symbol: 'h' },
      { id: 'd', name: 'Day', symbol: 'd' },
      { id: 'wk', name: 'Week', symbol: 'wk' },
    ],
    note: 'Months and years have no fixed length; use the date calculator for those.',
  },
];

/** Factor to the category base unit. */
const LENGTH: Readonly<Record<string, number>> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

const MASS: Readonly<Record<string, number>> = {
  mg: 0.000001,
  g: 0.001,
  kg: 1,
  t: 1000,
  oz: 0.028349523125,
  lb: 0.45359237,
  st: 6.35029318,
};

const VOLUME: Readonly<Record<string, number>> = {
  ml: 0.001,
  l: 1,
  m3: 1000,
  tsp: 0.00492892159375,
  tbsp: 0.01478676478125,
  cup: 0.2365882365,
  floz: 0.0295735295625,
  pint: 0.473176473,
  quart: 0.946352946,
  gal: 3.785411784,
};

const TIME: Readonly<Record<string, number>> = {
  ms: 0.001,
  s: 1,
  min: 60,
  h: 3600,
  d: 86400,
  wk: 604800,
};

const LINEAR_FACTORS: Readonly<
  Record<Exclude<UnitCategoryId, 'temperature'>, Readonly<Record<string, number>>>
> = {
  length: LENGTH,
  mass: MASS,
  volume: VOLUME,
  time: TIME,
};

const ABSOLUTE_ZERO_KELVIN = 0;

function toKelvin(value: number, unit: string): number {
  switch (unit) {
    case 'c':
      return value + 273.15;
    case 'f':
      return (value - 32) * (5 / 9) + 273.15;
    case 'k':
      return value;
    default:
      throw new RangeError(`Unknown temperature unit: ${unit}`);
  }
}

function fromKelvin(kelvin: number, unit: string): number {
  switch (unit) {
    case 'c':
      return kelvin - 273.15;
    case 'f':
      return (kelvin - 273.15) * (9 / 5) + 32;
    case 'k':
      return kelvin;
    default:
      throw new RangeError(`Unknown temperature unit: ${unit}`);
  }
}

export function getUnitCategory(id: UnitCategoryId): UnitCategory {
  const category = UNIT_CATEGORIES.find((entry) => entry.id === id);
  if (!category) throw new RangeError(`Unknown unit category: ${id}`);
  return category;
}

export function getUnit(category: UnitCategoryId, unitId: string): UnitDefinition {
  const unit = getUnitCategory(category).units.find((entry) => entry.id === unitId);
  if (!unit) throw new RangeError(`Unknown unit "${unitId}" in category "${category}"`);
  return unit;
}

/** Convert a finite value between two units of the same category. */
export function convertUnit(
  category: UnitCategoryId,
  from: string,
  to: string,
  value: number,
): number {
  if (!Number.isFinite(value)) throw new TypeError('convertUnit requires a finite value');

  if (category === 'temperature') {
    return fromKelvin(toKelvin(value, from), to);
  }

  const factors = LINEAR_FACTORS[category];
  const fromFactor = factors[from];
  const toFactor = factors[to];
  if (fromFactor === undefined || toFactor === undefined) {
    throw new RangeError(`Unknown unit conversion ${category}: ${from} -> ${to}`);
  }

  return (value * fromFactor) / toFactor;
}

/** True when a temperature is below absolute zero and must be rejected. */
export function isBelowAbsoluteZero(value: number, unit: string): boolean {
  return toKelvin(value, unit) < ABSOLUTE_ZERO_KELVIN;
}

/** Presentation helper: keeps small results readable without scientific notation. */
export function formatConvertedValue(value: number): string {
  if (!Number.isFinite(value)) return 'Not defined';
  return new Intl.NumberFormat('en', {
    maximumSignificantDigits: 10,
    maximumFractionDigits: 10,
  }).format(value);
}
