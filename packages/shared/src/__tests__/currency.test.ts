import { describe, expect, it } from 'vitest';
import { formatMoney, toMajorUnits, toMinorUnits } from '../format/currency';

describe('currency formatting', () => {
  it('formats minor units as localised currency', () => {
    const result = formatMoney({ amountMinor: 250000, currency: 'NGN', locale: 'en-NG' });
    expect(result).toContain('2,500.00');
    expect(result.startsWith('\u20A6')).toBe(true);
  });

  it('respects currencies without decimal places', () => {
    expect(formatMoney({ amountMinor: 1500, currency: 'JPY', locale: 'en' })).toContain('1,500');
  });

  it('supports plain numeric output for table columns', () => {
    expect(formatMoney({ amountMinor: 1299, currency: 'USD', locale: 'en', plain: true })).toBe(
      '12.99',
    );
  });

  it('rejects fractional minor units instead of rounding silently', () => {
    expect(() => formatMoney({ amountMinor: 10.5, currency: 'USD' })).toThrow(TypeError);
  });

  it('converts between major and minor units', () => {
    expect(toMinorUnits(19.99, 'USD')).toBe(1999);
    expect(toMajorUnits(1999, 'USD')).toBe(19.99);
  });
});
