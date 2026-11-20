/**
 * Deterministic text metrics.
 *
 * The canvas renderer measures real glyph widths at draw time. These helpers are
 * the *offline* counterpart: they estimate wrapped line counts so templates can
 * be authored, text boxes can be auto-sized and tests can assert on layout
 * without a browser. They are approximations, documented as such, and are never
 * used to decide what an export looks like.
 */

import type { FontFamilyId } from './document';

/** Mean glyph width as a fraction of font size, per family class. */
const CHAR_WIDTH_FACTOR: Readonly<Record<FontFamilyId, number>> = {
  sans: 0.53,
  serif: 0.5,
  geometric: 0.55,
  condensed: 0.43,
  mono: 0.6,
  rounded: 0.54,
};

/** Uppercase and wide characters need more room than the average. */
const WIDE_CHARACTERS = new Set('MWmw@%&—');

export interface TextMetricsInput {
  readonly text: string;
  /** Available width in document pixels. */
  readonly width: number;
  readonly fontSize: number;
  readonly fontFamily: FontFamilyId;
  readonly fontWeight?: number;
  readonly lineHeight: number;
  readonly letterSpacing?: number;
}

export interface TextMetrics {
  readonly lines: readonly string[];
  /** Total height in document pixels. */
  readonly height: number;
  /** True when at least one word had to be hard-broken. */
  readonly overflowedWord: boolean;
}

function characterWidth(character: string, input: TextMetricsInput): number {
  const base = CHAR_WIDTH_FACTOR[input.fontFamily] * input.fontSize;
  const weightFactor = (input.fontWeight ?? 400) >= 700 ? 1.06 : 1;
  const wide = WIDE_CHARACTERS.has(character) ? 1.35 : 1;
  const narrow = 'iljI.,:;\'!|'.includes(character) ? 0.72 : 1;
  return base * weightFactor * wide * narrow + (input.letterSpacing ?? 0);
}

function measureLine(line: string, input: TextMetricsInput): number {
  let width = 0;
  for (const character of line) width += characterWidth(character, input);
  return width;
}

/**
 * Greedy word wrap. Words longer than the line are split by character rather
 * than dropped, so a paste of a long URL cannot erase content.
 */
export function wrapText(input: TextMetricsInput): { lines: string[]; overflowedWord: boolean } {
  const maxWidth = Math.max(1, input.width);
  const paragraphs = input.text.split('\n');
  const lines: string[] = [];
  let overflowedWord = false;

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      if (word.length === 0) continue;
      const candidate = current.length === 0 ? word : `${current} ${word}`;

      if (measureLine(candidate, input) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current.length > 0) {
        lines.push(current);
      }

      if (measureLine(word, input) <= maxWidth) {
        current = word;
        continue;
      }

      // Hard-break an over-long word.
      overflowedWord = true;
      let chunk = '';
      for (const character of word) {
        if (chunk.length > 0 && measureLine(chunk + character, input) > maxWidth) {
          lines.push(chunk);
          chunk = character;
          continue;
        }
        chunk += character;
      }
      current = chunk;
    }

    if (current.length > 0) lines.push(current);
  }

  if (lines.length === 0) lines.push('');
  return { lines, overflowedWord };
}

export function estimateTextMetrics(input: TextMetricsInput): TextMetrics {
  const { lines, overflowedWord } = wrapText(input);
  return {
    lines,
    height: lines.length * input.fontSize * input.lineHeight,
    overflowedWord,
  };
}

/** Height a text box needs for its current width, used when creating a node. */
export function estimateTextHeight(input: TextMetricsInput): number {
  return estimateTextMetrics(input).height;
}