import { describe, expect, it } from 'vitest';
import { analyseText, countWords, formatMinutes, tokeniseWords } from '../tools/text-stats';

describe('tokeniseWords', () => {
  it('keeps hyphenated and apostrophised words together', () => {
    expect(tokeniseWords("A well-known writer's draft")).toEqual([
      'A',
      'well-known',
      "writer's",
      'draft',
    ]);
  });

  it('handles accented and non-Latin scripts', () => {
    expect(tokeniseWords('café déjà vu')).toEqual(['café', 'déjà', 'vu']);
    expect(tokeniseWords('Привет мир')).toEqual(['Привет', 'мир']);
  });
});

describe('countWords', () => {
  it('counts words separated by any whitespace', () => {
    expect(countWords('one two\tthree\nfour')).toBe(4);
  });

  it('counts Chinese characters individually', () => {
    expect(countWords('你好世界')).toBe(4);
  });

  it('returns zero for blank input', () => {
    expect(countWords('   \n  ')).toBe(0);
  });
});

describe('analyseText', () => {
  const text = 'Hello world. This is a test!\n\nSecond paragraph here.';

  it('reports counts for words, characters and structure', () => {
    const stats = analyseText(text);
    expect(stats.words).toBe(9);
    expect(stats.characters).toBe(text.length);
    expect(stats.sentences).toBe(3);
    expect(stats.paragraphs).toBe(2);
    expect(stats.lines).toBe(3);
  });

  it('excludes whitespace from the character count without spaces', () => {
    const stats = analyseText('ab cd');
    expect(stats.characters).toBe(5);
    expect(stats.charactersNoSpaces).toBe(4);
  });

  it('estimates reading and speaking time', () => {
    const stats = analyseText('word '.repeat(400));
    expect(stats.words).toBe(400);
    expect(stats.readingMinutes).toBeCloseTo(2, 5);
    expect(stats.speakingMinutes).toBeCloseTo(400 / 130, 5);
  });

  it('counts an emoji as one character', () => {
    expect(analyseText('👍').characters).toBe(1);
  });

  it('reports repeated words and the longest word', () => {
    const stats = analyseText('blue blue extraordinary blue');
    expect(stats.uniqueWords).toBe(2);
    expect(stats.longestWord).toBe('extraordinary');
    expect(stats.averageWordLength).toBe(6.3);
  });

  it('returns zeroed statistics for empty input', () => {
    const stats = analyseText('');
    expect(stats.words).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.sentences).toBe(0);
    expect(stats.paragraphs).toBe(0);
    expect(stats.lines).toBe(0);
    expect(stats.readingMinutes).toBe(0);
    expect(stats.longestWord).toBe('');
  });
});

describe('formatMinutes', () => {
  it('formats durations for people', () => {
    expect(formatMinutes(0)).toBe('0 sec');
    expect(formatMinutes(0.5)).toBe('30 sec');
    expect(formatMinutes(1.3333)).toBe('1 min 20 sec');
    expect(formatMinutes(12)).toBe('12 min');
  });
});
