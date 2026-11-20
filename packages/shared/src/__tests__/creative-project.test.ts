import { describe, expect, it } from 'vitest';
import {
  createCreativeDocument,
  estimateTextHeight,
  estimateTextMetrics,
  parseProjectFile,
  requirePreset,
  serialiseProjectFile,
  toProjectFile,
  canvasFromPreset,
  wrapText,
} from '../index';

const document = createCreativeDocument({
  title: 'Portable design',
  canvas: canvasFromPreset(requirePreset('social-square')),
  now: new Date('2026-01-01T00:00:00.000Z'),
});

describe('project files', () => {
  it('round-trips a document', () => {
    const result = parseProjectFile(serialiseProjectFile(document));
    expect(result.ok).toBe(true);
    expect(result.project?.document.title).toBe('Portable design');
    expect(result.project?.document.nodes).toHaveLength(0);
  });

  it('wraps a document with the project envelope', () => {
    const file = toProjectFile(document);
    expect(file.kind).toBe('quickbiz.creative-project');
    expect(file.version).toBe(1);
  });

  it('rejects a file that is not JSON', () => {
    const result = parseProjectFile('not json at all');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not valid JSON/);
  });

  it('rejects a JSON file that is not a project', () => {
    const result = parseProjectFile(JSON.stringify({ hello: 'world' }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a QuickBiz Creative Studio project/);
  });

  it('rejects a project whose document fails validation', () => {
    const broken = JSON.stringify({
      kind: 'quickbiz.creative-project',
      version: 1,
      document: { ...document, title: '' },
    });
    const result = parseProjectFile(broken);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid design document/);
  });

  it('explains an unsupported document version', () => {
    const future = JSON.stringify({
      kind: 'quickbiz.creative-project',
      version: 1,
      document: { ...document, version: 42 },
    });
    const result = parseProjectFile(future);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not support/);
  });

  it('refuses an oversized payload before parsing', () => {
    const huge = 'x'.repeat(9 * 1024 * 1024);
    const result = parseProjectFile(huge);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too large/);
  });

  it('allows a smaller configured ceiling to be enforced', () => {
    const result = parseProjectFile(serialiseProjectFile(document), { maxBytes: 10 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too large/);
  });
});

describe('text metrics', () => {
  const input = {
    width: 400,
    fontSize: 40,
    fontFamily: 'sans' as const,
    lineHeight: 1.2,
  };

  it('wraps a long sentence into several lines', () => {
    const { lines } = wrapText({ ...input, text: 'A headline that is far too long for one line' });
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toContain('headline');
  });

  it('hard-breaks a single over-long word instead of dropping it', () => {
    const word = 'a'.repeat(200);
    const { lines, overflowedWord } = wrapText({ ...input, text: word });
    expect(overflowedWord).toBe(true);
    expect(lines.join('')).toBe(word);
  });

  it('keeps explicit line breaks', () => {
    const { lines } = wrapText({ ...input, text: 'one\ntwo' });
    expect(lines).toEqual(['one', 'two']);
  });

  it('reports a height that grows with the number of lines', () => {
    const short = estimateTextMetrics({ ...input, text: 'Hi' });
    const long = estimateTextMetrics({ ...input, text: 'Hi '.repeat(40) });
    expect(long.height).toBeGreaterThan(short.height);
    expect(short.height).toBeCloseTo(48, 5);
  });

  it('never returns a zero height', () => {
    expect(estimateTextHeight({ ...input, text: '' })).toBeGreaterThan(0);
  });
});
