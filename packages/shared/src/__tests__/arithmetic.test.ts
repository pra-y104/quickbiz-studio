import { describe, expect, it } from 'vitest';
import { evaluateExpression, formatDecimal, parseDecimalInput, roundTo } from '../tools/arithmetic';

function value(input: string): number {
  const result = evaluateExpression(input);
  if (!result.ok) throw new Error(`Expected success for "${input}", got ${result.error}`);
  return result.value;
}

function error(input: string): string {
  const result = evaluateExpression(input);
  if (result.ok) throw new Error(`Expected failure for "${input}", got ${result.value}`);
  return result.error;
}

describe('evaluateExpression', () => {
  it('respects operator precedence', () => {
    expect(value('2+3*4')).toBe(14);
    expect(value('10-4/2')).toBe(8);
  });

  it('supports parentheses and nesting', () => {
    expect(value('(2+3)*4')).toBe(20);
    expect(value('2*(3+(4-1))')).toBe(12);
  });

  it('supports unary signs', () => {
    expect(value('-5+2')).toBe(-3);
    expect(value('-(4+1)')).toBe(-5);
    expect(value('3*-2')).toBe(-6);
  });

  it('supports decimals', () => {
    expect(value('0.1+0.2')).toBeCloseTo(0.3, 10);
    expect(value('12.5*4')).toBe(50);
  });

  it('treats a trailing percent as a division by 100', () => {
    expect(value('50%')).toBe(0.5);
    expect(value('200*10%')).toBe(20);
    expect(value('(200+50)%')).toBeCloseTo(2.5, 10);
  });

  it('accepts unicode operators and ignores digit grouping', () => {
    expect(value('6\u00d77\u00f72')).toBe(21);
    expect(value('1,000+500')).toBe(1500);
    expect(value('7\u22122')).toBe(5);
  });

  it('rejects division by zero instead of returning Infinity', () => {
    expect(error('5/0')).toBe('division-by-zero');
    expect(error('5/(2-2)')).toBe('division-by-zero');
  });

  it('reports empty, malformed and unbalanced input', () => {
    expect(error('   ')).toBe('empty');
    expect(error('2+')).toBe('unexpected-token');
    expect(error('(2+3')).toBe('unbalanced-parenthesis');
    expect(error('2+3)')).toBe('unexpected-token');
    expect(error('1.2.3')).toBe('unexpected-token');
    expect(error('hello')).toBe('invalid-character');
  });

  it('rejects absurdly long input', () => {
    expect(error('1+'.repeat(200) + '1')).toBe('too-long');
  });
});

describe('number helpers', () => {
  it('rounds away from zero without binary drift', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(roundTo(2.5)).toBe(3);
  });

  it('formats decimals with grouping and a decimal cap', () => {
    expect(formatDecimal(1234567.891)).toBe('1,234,567.891');
    expect(formatDecimal(0.1 + 0.2)).toBe('0.3');
    expect(formatDecimal(Number.POSITIVE_INFINITY)).toBe('Not defined');
  });

  it('parses decimal input safely', () => {
    expect(parseDecimalInput('1,250.50')).toBe(1250.5);
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('-')).toBeNull();
    expect(parseDecimalInput('12abc')).toBeNull();
  });
});
