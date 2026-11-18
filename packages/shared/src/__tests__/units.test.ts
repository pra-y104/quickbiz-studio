import { describe, expect, it } from 'vitest';
import {
  UNIT_CATEGORIES,
  convertUnit,
  formatConvertedValue,
  getUnitCategory,
  isBelowAbsoluteZero,
} from '../tools/units';

describe('unit catalogue', () => {
  it('covers the required everyday categories', () => {
    const ids = UNIT_CATEGORIES.map((category) => category.id);
    expect(ids).toEqual(['length', 'mass', 'temperature', 'volume', 'time']);
  });

  it('has unique unit ids inside each category', () => {
    for (const category of UNIT_CATEGORIES) {
      const ids = category.units.map((unit) => unit.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(category.defaultFrom);
      expect(ids).toContain(category.defaultTo);
    }
  });
});

describe('convertUnit', () => {
  it('converts length', () => {
    expect(convertUnit('length', 'km', 'm', 1)).toBe(1000);
    expect(convertUnit('length', 'mi', 'km', 1)).toBeCloseTo(1.609344, 6);
    expect(convertUnit('length', 'in', 'cm', 1)).toBeCloseTo(2.54, 6);
    expect(convertUnit('length', 'ft', 'm', 3)).toBeCloseTo(0.9144, 6);
  });

  it('converts mass', () => {
    expect(convertUnit('mass', 'kg', 'lb', 1)).toBeCloseTo(2.2046226218, 6);
    expect(convertUnit('mass', 't', 'kg', 2)).toBe(2000);
    expect(convertUnit('mass', 'st', 'lb', 1)).toBeCloseTo(14, 4);
  });

  it('converts temperature affinely, not by ratio', () => {
    expect(convertUnit('temperature', 'c', 'f', 0)).toBe(32);
    expect(convertUnit('temperature', 'c', 'f', 100)).toBe(212);
    expect(convertUnit('temperature', 'f', 'c', 32)).toBe(0);
    expect(convertUnit('temperature', 'c', 'k', 0)).toBeCloseTo(273.15, 6);
    expect(convertUnit('temperature', 'k', 'c', 0)).toBeCloseTo(-273.15, 6);
  });

  it('converts volume and time', () => {
    expect(convertUnit('volume', 'gal', 'l', 1)).toBeCloseTo(3.785411784, 6);
    expect(convertUnit('volume', 'cup', 'ml', 1)).toBeCloseTo(236.5882365, 6);
    expect(convertUnit('time', 'wk', 'h', 1)).toBe(168);
    expect(convertUnit('time', 'h', 'min', 2.5)).toBe(150);
  });

  it('round-trips through the base unit', () => {
    const there = convertUnit('mass', 'oz', 'g', 12);
    expect(convertUnit('mass', 'g', 'oz', there)).toBeCloseTo(12, 8);
  });

  it('rejects unknown units and non-finite values', () => {
    expect(() => convertUnit('length', 'parsec', 'm', 1)).toThrow(RangeError);
    expect(() => convertUnit('mass', 'kg', 'kg', Number.NaN)).toThrow(TypeError);
    expect(() => getUnitCategory('volume')).not.toThrow();
  });

  it('detects temperatures below absolute zero', () => {
    expect(isBelowAbsoluteZero(-1, 'k')).toBe(true);
    expect(isBelowAbsoluteZero(-274, 'c')).toBe(true);
    expect(isBelowAbsoluteZero(0, 'k')).toBe(false);
  });

  it('formats small and large results readably', () => {
    expect(formatConvertedValue(0.000001)).toBe('0.000001');
    expect(formatConvertedValue(1234567.89)).toBe('1,234,567.89');
  });
});
