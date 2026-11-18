/**
 * Word and character statistics.
 *
 * Counting is Unicode-aware: accented Latin words, Arabic, Cyrillic and
 * Devanagari count as words, and Chinese/Japanese/Thai runs count per
 * character because those scripts do not separate words with spaces.
 */

const CJK_WORD = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]+$/u;

const WORD =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]+|[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu;

/** Words per minute, used for the reading-time estimate. */
export const READING_WORDS_PER_MINUTE = 200;

/** Words per minute for reading aloud. */
export const SPEAKING_WORDS_PER_MINUTE = 130;

export interface TextStatistics {
  /** Grapheme clusters, so an emoji counts once. */
  readonly characters: number;
  readonly charactersNoSpaces: number;
  readonly words: number;
  readonly uniqueWords: number;
  readonly sentences: number;
  readonly paragraphs: number;
  readonly lines: number;
  readonly readingMinutes: number;
  readonly speakingMinutes: number;
  readonly longestWord: string;
  /** Average word length in characters, rounded to one decimal. */
  readonly averageWordLength: number;
}

const graphemeSegmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', { granularity: 'grapheme' })
    : null;

function countGraphemes(text: string): number {
  if (graphemeSegmenter) {
    let total = 0;
    for (const _segment of graphemeSegmenter.segment(text)) total += 1;
    return total;
  }
  return Array.from(text).length;
}

/** Split text into words, keeping hyphenated and apostrophised words whole. */
export function tokeniseWords(text: string): string[] {
  return text.match(WORD) ?? [];
}

export function countWords(text: string): number {
  let total = 0;
  for (const token of tokeniseWords(text)) {
    total += CJK_WORD.test(token) ? countGraphemes(token) : 1;
  }
  return total;
}

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  // Terminators followed by space or a line break; blank lines also end a
  // sentence. "e.g. this" over-counts by one, which is acceptable for an
  // estimate and is documented in the interface.
  const parts = trimmed
    .split(/(?<=[.!?\u2026])["'\u201d\u2019)\]]*\s+|\n{2,}/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.length === 0 ? 1 : parts.length;
}

function countParagraphs(text: string): number {
  return text
    .split(/\n\s*\n/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

function countLines(text: string): number {
  if (text.trim().length === 0) return 0;
  return text.split('\n').length;
}

export function analyseText(text: string): TextStatistics {
  const words = tokeniseWords(text);
  const wordCount = countWords(text);
  const letters = words.filter((word) => !CJK_WORD.test(word));

  const longestWord = words.reduce(
    (longest, word) => (countGraphemes(word) > countGraphemes(longest) ? word : longest),
    '',
  );

  const letterCharacters = letters.reduce((total, word) => total + countGraphemes(word), 0);
  const averageWordLength =
    letters.length === 0 ? 0 : Math.round((letterCharacters / letters.length) * 10) / 10;

  const unique = new Set(words.map((word) => word.toLocaleLowerCase('en')));

  return {
    characters: countGraphemes(text),
    charactersNoSpaces: countGraphemes(text.replace(/\s/gu, '')),
    words: wordCount,
    uniqueWords: unique.size,
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    lines: countLines(text),
    readingMinutes: wordCount / READING_WORDS_PER_MINUTE,
    speakingMinutes: wordCount / SPEAKING_WORDS_PER_MINUTE,
    longestWord,
    averageWordLength,
  };
}

/** "0 sec", "45 sec", "1 min 20 sec", "12 min". */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 sec';

  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds} sec`;

  const wholeMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${wholeMinutes} min` : `${wholeMinutes} min ${seconds} sec`;
}
