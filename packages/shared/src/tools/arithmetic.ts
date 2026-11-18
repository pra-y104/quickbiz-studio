/**
 * Arithmetic evaluation for the basic calculator.
 *
 * The calculator never uses `eval` or `new Function`: input is tokenised and
 * parsed by a small recursive-descent parser, so a pasted string can never
 * execute code. Only the four operations, parentheses, unary signs and a
 * postfix percent operator are accepted.
 */

export const CALCULATOR_MAX_INPUT = 240;

export const EXPRESSION_ERRORS = [
  'empty',
  'too-long',
  'invalid-character',
  'unexpected-token',
  'unbalanced-parenthesis',
  'division-by-zero',
  'not-finite',
  'too-deep',
] as const;

export type ExpressionError = (typeof EXPRESSION_ERRORS)[number];

export type ExpressionResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: ExpressionError };

type BinaryOperator = '+' | '-' | '*' | '/';

type Token =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'operator'; readonly value: BinaryOperator }
  | { readonly type: 'paren'; readonly value: '(' | ')' }
  | { readonly type: 'percent' };

const OPERATOR_ALIASES: Readonly<Record<string, BinaryOperator>> = {
  '+': '+',
  '-': '-',
  '\u2212': '-', // unicode minus
  '*': '*',
  '\u00d7': '*', // multiplication sign
  '/': '/',
  '\u00f7': '/', // division sign
};

const MAX_DEPTH = 24;

/** Group thousands separators without touching real values such as "1.5". */
function normaliseInput(input: string): string {
  return input.replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1');
}

function tokenise(source: string): Token[] | ExpressionError {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index] as string;

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    const operator = OPERATOR_ALIASES[character];
    if (operator) {
      tokens.push({ type: 'operator', value: operator });
      index += 1;
      continue;
    }

    if (character === '(' || character === ')') {
      tokens.push({ type: 'paren', value: character });
      index += 1;
      continue;
    }

    if (character === '%') {
      tokens.push({ type: 'percent' });
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(character)) {
      let raw = '';
      while (index < source.length && /[0-9.]/.test(source[index] as string)) {
        raw += source[index];
        index += 1;
      }
      // "1.2.3" is not a number; reject rather than silently truncating.
      if ((raw.match(/\./g) ?? []).length > 1 || raw === '.') {
        return 'unexpected-token';
      }
      tokens.push({ type: 'number', value: Number.parseFloat(raw) });
      continue;
    }

    return 'invalid-character';
  }

  return tokens;
}

class Parser {
  private position = 0;
  private depth = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): ExpressionResult {
    if (this.tokens.length === 0) return { ok: false, error: 'empty' };

    try {
      const value = this.parseExpression();
      if (this.position !== this.tokens.length) {
        return { ok: false, error: 'unexpected-token' };
      }
      if (!Number.isFinite(value)) return { ok: false, error: 'not-finite' };
      return { ok: true, value };
    } catch (error) {
      const reason = error instanceof ExpressionFailure ? error.reason : 'unexpected-token';
      return { ok: false, error: reason };
    }
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    for (;;) {
      const token = this.peek();
      if (token?.type !== 'operator' || (token.value !== '+' && token.value !== '-')) break;
      this.position += 1;
      const right = this.parseTerm();
      value = token.value === '+' ? value + right : value - right;
    }

    return value;
  }

  private parseTerm(): number {
    let value = this.parseUnary();

    for (;;) {
      const token = this.peek();
      if (token?.type !== 'operator' || (token.value !== '*' && token.value !== '/')) break;
      this.position += 1;
      const right = this.parseUnary();
      if (token.value === '/') {
        if (right === 0) throw new ExpressionFailure('division-by-zero');
        value /= right;
      } else {
        value *= right;
      }
    }

    return value;
  }

  private parseUnary(): number {
    const token = this.peek();

    if (token?.type === 'operator' && (token.value === '+' || token.value === '-')) {
      this.position += 1;
      const value = this.parseUnary();
      return token.value === '-' ? -value : value;
    }

    return this.parsePercent();
  }

  /** Postfix percent: `50%` means 0.5, and `200 * 10%` means 200 * 0.1. */
  private parsePercent(): number {
    let value = this.parsePrimary();

    for (;;) {
      const token = this.peek();
      if (token?.type !== 'percent') break;
      this.position += 1;
      value /= 100;
    }

    return value;
  }

  private parsePrimary(): number {
    const token = this.peek();
    if (!token) throw new ExpressionFailure('unexpected-token');

    if (token.type === 'number') {
      this.position += 1;
      return token.value;
    }

    if (token.type === 'paren' && token.value === '(') {
      this.position += 1;
      this.depth += 1;
      if (this.depth > MAX_DEPTH) throw new ExpressionFailure('too-deep');

      const value = this.parseExpression();

      const closing = this.peek();
      if (closing?.type !== 'paren' || closing.value !== ')') {
        throw new ExpressionFailure('unbalanced-parenthesis');
      }
      this.position += 1;
      this.depth -= 1;
      return value;
    }

    throw new ExpressionFailure('unexpected-token');
  }
}

class ExpressionFailure extends Error {
  constructor(readonly reason: ExpressionError) {
    super(reason);
    this.name = 'ExpressionFailure';
  }
}

/**
 * Evaluate an arithmetic expression.
 *
 * Returns a discriminated result instead of throwing so the UI can map a stable
 * error code to friendly copy.
 */
export function evaluateExpression(input: string): ExpressionResult {
  if (input.trim().length === 0) return { ok: false, error: 'empty' };
  if (input.length > CALCULATOR_MAX_INPUT) return { ok: false, error: 'too-long' };

  const tokens = tokenise(normaliseInput(input));
  if (!Array.isArray(tokens)) return { ok: false, error: tokens };

  return new Parser(tokens).parse();
}

/** Round half away from zero, avoiding binary drift such as 1.005 -> 1.00. */
export function roundTo(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  // `toPrecision` removes the representation error before rounding, so
  // 1.005 * 100 = 100.49999... still rounds to 101.
  const scaled = Number((value * factor).toPrecision(15));
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return rounded / factor;
}

/** Group a decimal for display, trimming the noise created by floats. */
export function formatDecimal(value: number, maxFractionDigits = 10): string {
  if (!Number.isFinite(value)) return 'Not defined';
  const cleaned = roundTo(value, maxFractionDigits);
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: maxFractionDigits,
  }).format(cleaned);
}

/** Parsed decimal input; `null` when the field is empty or malformed. */
export function parseDecimalInput(value: string): number | null {
  const trimmed = normaliseInput(value).trim().replace(/\s/g, '');
  if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
  if (!/^-?\d*(?:\.\d*)?$/.test(trimmed)) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
