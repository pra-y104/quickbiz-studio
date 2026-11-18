/**
 * Text and document formatting operations.
 *
 * Every operation is a pure function, so a combination can be applied in a
 * chosen order and the result can be copied, downloaded or tested without any
 * browser state. Operations never delete content silently: anything that
 * changes meaning (sorting, de-duplicating, stripping HTML) says so in its
 * description, which the interface shows before use.
 */

export const TEXT_TRANSFORM_GROUPS = ['case', 'spacing', 'lines', 'cleanup'] as const;

export type TextTransformGroup = (typeof TEXT_TRANSFORM_GROUPS)[number];

export interface TextTransformation {
  readonly id: string;
  readonly label: string;
  readonly group: TextTransformGroup;
  readonly description: string;
  readonly apply: (text: string) => string;
}

export const TEXT_GROUP_LABELS: Readonly<Record<TextTransformGroup, string>> = {
  case: 'Letter case',
  spacing: 'Spacing and line breaks',
  lines: 'Line organisation',
  cleanup: 'Cleanup',
};

function splitWords(text: string): string[] {
  return text
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

function capitalise(word: string): string {
  if (word.length === 0) return word;
  const [first, ...rest] = Array.from(word);
  return `${(first ?? '').toLocaleUpperCase('en')}${rest.join('').toLocaleLowerCase('en')}`;
}

function upper(text: string): string {
  return text.toLocaleUpperCase('en');
}

function lower(text: string): string {
  return text.toLocaleLowerCase('en');
}

function titleCase(text: string): string {
  return text.replace(/\p{L}[\p{L}\p{N}'\u2019-]*/gu, (word) => capitalise(word));
}

function sentenceCase(text: string): string {
  const lowered = text.toLocaleLowerCase('en');
  return lowered.replace(
    /(^|[.!?\u2026]\s+)(\p{L})/gu,
    (_match, prefix: string, letter: string) => {
      return `${prefix}${letter.toLocaleUpperCase('en')}`;
    },
  );
}

function camelCase(text: string): string {
  const words = splitWords(text);
  return words.map((word, index) => (index === 0 ? word.toLowerCase() : capitalise(word))).join('');
}

function pascalCase(text: string): string {
  return splitWords(text)
    .map((word) => capitalise(word))
    .join('');
}

function snakeCase(text: string): string {
  return splitWords(text)
    .map((word) => word.toLowerCase())
    .join('_');
}

function kebabCase(text: string): string {
  return splitWords(text)
    .map((word) => word.toLowerCase())
    .join('-');
}

function constantCase(text: string): string {
  return splitWords(text)
    .map((word) => word.toUpperCase())
    .join('_');
}

function collapseSpaces(text: string): string {
  return text.replace(/[ \t\f\v]+/gu, ' ').replace(/ ?\n ?/gu, '\n');
}

function trimLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

function removeBlankLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

function removeLineBreaks(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ');
}

function fixPunctuationSpacing(text: string): string {
  return text
    .replace(/[ \t]+([,.;:!?])/gu, '$1')
    .replace(/([,.;:!?])(?=[^\s,.;:!?])/gu, '$1 ')
    .replace(/[ \t]{2,}/gu, ' ');
}

function sortLines(text: string): string {
  return text
    .split('\n')
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }))
    .join('\n');
}

function dedupeLines(text: string): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of text.split('\n')) {
    const key = line.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result.join('\n');
}

function reverseLines(text: string): string {
  return text.split('\n').reverse().join('\n');
}

function numberLines(text: string): string {
  let counter = 0;
  return text
    .split('\n')
    .map((line) => {
      if (line.trim().length === 0) return line;
      counter += 1;
      return `${counter}. ${line}`;
    })
    .join('\n');
}

function bulletLines(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim().length === 0 ? line : `\u2022 ${line}`))
    .join('\n');
}

function normaliseQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/gu, "'")
    .replace(/[\u201C\u201D\u201F]/gu, '"')
    .replace(/\u2013/gu, '-')
    .replace(/\u2014/gu, '-')
    .replace(/\u2026/gu, '...');
}

function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

export const TEXT_TRANSFORMATIONS: readonly TextTransformation[] = [
  {
    id: 'upper',
    label: 'UPPERCASE',
    group: 'case',
    description: 'Every letter becomes a capital.',
    apply: upper,
  },
  {
    id: 'lower',
    label: 'lowercase',
    group: 'case',
    description: 'Every letter becomes small.',
    apply: lower,
  },
  {
    id: 'title',
    label: 'Title Case',
    group: 'case',
    description: 'Capitalises the first letter of every word.',
    apply: titleCase,
  },
  {
    id: 'sentence',
    label: 'Sentence case',
    group: 'case',
    description: 'Capitalises the start of each sentence and lowers the rest.',
    apply: sentenceCase,
  },
  {
    id: 'camel',
    label: 'camelCase',
    group: 'case',
    description: 'Joins words without spaces; each later word is capitalised.',
    apply: camelCase,
  },
  {
    id: 'pascal',
    label: 'PascalCase',
    group: 'case',
    description: 'Joins words without spaces; every word is capitalised.',
    apply: pascalCase,
  },
  {
    id: 'snake',
    label: 'snake_case',
    group: 'case',
    description: 'Joins lowercase words with underscores.',
    apply: snakeCase,
  },
  {
    id: 'kebab',
    label: 'kebab-case',
    group: 'case',
    description: 'Joins lowercase words with hyphens.',
    apply: kebabCase,
  },
  {
    id: 'constant',
    label: 'CONSTANT_CASE',
    group: 'case',
    description: 'Joins uppercase words with underscores.',
    apply: constantCase,
  },
  {
    id: 'collapse-spaces',
    label: 'Collapse spaces',
    group: 'spacing',
    description: 'Replaces repeated spaces and tabs with a single space.',
    apply: collapseSpaces,
  },
  {
    id: 'remove-line-breaks',
    label: 'Join lines',
    group: 'spacing',
    description: 'Merges every line into one paragraph.',
    apply: removeLineBreaks,
  },
  {
    id: 'trim-lines',
    label: 'Trim each line',
    group: 'spacing',
    description: 'Removes leading and trailing spaces on every line.',
    apply: trimLines,
  },
  {
    id: 'remove-blank-lines',
    label: 'Remove blank lines',
    group: 'spacing',
    description: 'Deletes empty lines, keeping one entry per non-empty line.',
    apply: removeBlankLines,
  },
  {
    id: 'punctuation-spacing',
    label: 'Fix punctuation spacing',
    group: 'spacing',
    description: 'Removes spaces before punctuation and adds one after it.',
    apply: fixPunctuationSpacing,
  },
  {
    id: 'sort-lines',
    label: 'Sort A-Z',
    group: 'lines',
    description: 'Sorts lines alphabetically, numbers before letters.',
    apply: sortLines,
  },
  {
    id: 'dedupe-lines',
    label: 'Remove duplicate lines',
    group: 'lines',
    description: 'Keeps the first copy of each line and drops later repeats.',
    apply: dedupeLines,
  },
  {
    id: 'reverse-lines',
    label: 'Reverse order',
    group: 'lines',
    description: 'Reverses the order of the lines.',
    apply: reverseLines,
  },
  {
    id: 'number-lines',
    label: 'Number lines',
    group: 'lines',
    description: 'Adds 1., 2., 3. and so on to each non-empty line.',
    apply: numberLines,
  },
  {
    id: 'bullet-lines',
    label: 'Bullet list',
    group: 'lines',
    description: 'Turns each non-empty line into a bullet point.',
    apply: bulletLines,
  },
  {
    id: 'normalise-quotes',
    label: 'Straight quotes',
    group: 'cleanup',
    description: 'Replaces curly quotes, dashes and ellipses with plain characters.',
    apply: normaliseQuotes,
  },
  {
    id: 'strip-html',
    label: 'Strip HTML',
    group: 'cleanup',
    description: 'Removes tags and decodes common entities from pasted web text.',
    apply: stripHtml,
  },
];

export function getTransformation(id: string): TextTransformation | undefined {
  return TEXT_TRANSFORMATIONS.find((transformation) => transformation.id === id);
}

/** Apply transformations in the given order and return the final text. */
export function applyTransformations(text: string, ids: readonly string[]): string {
  let result = text;
  for (const id of ids) {
    const transformation = getTransformation(id);
    if (transformation) result = transformation.apply(result);
  }
  return result;
}
