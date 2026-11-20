import { describe, expect, it } from 'vitest';
import {
  canvasFromPreset,
  createCreativeDocument,
  parseCreativeDocument,
  requirePreset,
  type CreativeNode,
} from '../index';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function base(nodes: readonly unknown[]) {
  return createCreativeDocument({
    title: 'Group test',
    canvas: canvasFromPreset(requirePreset('social-square')),
    nodes: nodes as CreativeNode[],
    now: NOW,
  });
}

function textNode(id: string): CreativeNode {
  return {
    id,
    type: 'text',
    name: id,
    x: 0,
    y: 0,
    width: 200,
    height: 60,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: 'Hi',
    fontFamily: 'sans',
    fontSize: 40,
    fontWeight: 600,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.15,
    letterSpacing: 0,
    color: '#000000',
    verticalAlign: 'top',
  } as CreativeNode;
}

function group(id: string, children: unknown): object {
  return {
    id,
    type: 'group',
    name: id,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    children,
  };
}

describe('group depth (M3)', () => {
  it('accepts a group containing ordinary nodes', () => {
    const document = base([group('g', [textNode('a'), textNode('b')])]);
    const result = parseCreativeDocument(document);
    expect(result.ok).toBe(true);
  });

  it('rejects a group nested inside a group', () => {
    const document = base([group('outer', [group('inner', [textNode('a')])])]);
    const result = parseCreativeDocument(document);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((issue) => issue.path).join(' ');
      expect(paths.length).toBeGreaterThan(0);
      expect(result.issues.every((issue) => issue.message.length > 0)).toBe(true);
    }
  });

  it('does not recurse when counting deeply nested input', () => {
    // A document built by hand can still nest; counting must not blow the stack.
    let node: unknown = textNode('leaf');
    for (let index = 0; index < 2_000; index += 1) {
      node = group(`g${index}`, [node]);
    }

    const document = base([]);
    const withDeep = { ...document, nodes: [node] };
    const result = parseCreativeDocument(withDeep);

    // Rejected by validation, and no RangeError escapes.
    expect(result.ok).toBe(false);
  });
});
