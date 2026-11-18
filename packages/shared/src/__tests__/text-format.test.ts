import { describe, expect, it } from 'vitest';
import {
  TEXT_TRANSFORMATIONS,
  applyTransformations,
  getTransformation,
} from '../tools/text-format';

function run(id: string, input: string): string {
  const transformation = getTransformation(id);
  if (!transformation) throw new Error(`Unknown transformation ${id}`);
  return transformation.apply(input);
}

describe('text transformation catalogue', () => {
  it('exposes unique ids and a description for every operation', () => {
    const ids = TEXT_TRANSFORMATIONS.map((transformation) => transformation.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const transformation of TEXT_TRANSFORMATIONS) {
      expect(transformation.description.length).toBeGreaterThan(10);
    }
  });
});

describe('case conversions', () => {
  it('converts simple cases', () => {
    expect(run('upper', 'Hello World')).toBe('HELLO WORLD');
    expect(run('lower', 'Hello WORLD')).toBe('hello world');
    expect(run('title', 'the quick brown fox')).toBe('The Quick Brown Fox');
    expect(run('sentence', 'HELLO THERE. HOW ARE YOU?')).toBe('Hello there. How are you?');
  });

  it('converts identifier styles', () => {
    expect(run('camel', 'quick biz studio')).toBe('quickBizStudio');
    expect(run('pascal', 'quick biz studio')).toBe('QuickBizStudio');
    expect(run('snake', 'Quick Biz Studio')).toBe('quick_biz_studio');
    expect(run('kebab', 'Quick Biz Studio')).toBe('quick-biz-studio');
    expect(run('constant', 'quick biz studio')).toBe('QUICK_BIZ_STUDIO');
  });

  it('splits camelCase input before re-joining', () => {
    expect(run('snake', 'quickBizStudio')).toBe('quick_biz_studio');
  });
});

describe('spacing operations', () => {
  it('collapses repeated spaces and preserves line breaks', () => {
    expect(run('collapse-spaces', 'a   b\t\tc\nd   e')).toBe('a b c\nd e');
  });

  it('joins lines into one paragraph', () => {
    expect(run('remove-line-breaks', 'one\n  two\n\nthree')).toBe('one two three');
  });

  it('trims and removes blank lines', () => {
    expect(run('trim-lines', '  a  \n  b ')).toBe('a\nb');
    expect(run('remove-blank-lines', 'a\n\n\nb\n')).toBe('a\nb');
  });

  it('fixes punctuation spacing', () => {
    expect(run('punctuation-spacing', 'Hello ,world !  Yes')).toBe('Hello, world! Yes');
  });
});

describe('line operations', () => {
  it('sorts, de-duplicates and reverses lines', () => {
    expect(run('sort-lines', 'banana\nApple\ncherry')).toBe('Apple\nbanana\ncherry');
    expect(run('dedupe-lines', 'a\nb\na\nc')).toBe('a\nb\nc');
    expect(run('reverse-lines', 'a\nb\nc')).toBe('c\nb\na');
  });

  it('numbers and bullets only non-empty lines', () => {
    expect(run('number-lines', 'a\n\nb')).toBe('1. a\n\n2. b');
    expect(run('bullet-lines', 'a\nb')).toBe('\u2022 a\n\u2022 b');
  });
});

describe('cleanup operations', () => {
  it('normalises curly typography', () => {
    expect(run('normalise-quotes', '\u201cHi\u201d \u2014 it\u2019s fine\u2026')).toBe(
      '"Hi" - it\'s fine...',
    );
  });

  it('strips HTML and decodes common entities', () => {
    const html = '<p>Hello&nbsp;<strong>world</strong> &amp; friends</p>';
    expect(run('strip-html', html)).toBe('Hello world & friends');
    expect(run('strip-html', '<script>alert(1)</script>safe')).toBe('safe');
  });
});

describe('applyTransformations', () => {
  it('applies steps in the given order', () => {
    expect(applyTransformations('  b  \n  a  ', ['trim-lines', 'sort-lines'])).toBe('a\nb');
  });

  it('ignores unknown ids instead of throwing', () => {
    expect(applyTransformations('keep', ['does-not-exist'])).toBe('keep');
  });
});
