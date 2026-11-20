import { describe, expect, it } from 'vitest';
import { createCreativeDocument, requirePreset, canvasFromPreset } from '@quickbiz/shared';
import {
  addNode,
  addNodes,
  alignSelection,
  createImageNode,
  createShapeNode,
  createTextNode,
  duplicateNodes,
  groupNodes,
  moveNodes,
  removeNodes,
  reorderNode,
  updateNode,
} from '../engine/commands';
import { DocumentHistory } from '../engine/history';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function emptyDocument() {
  return createCreativeDocument({
    title: 'Engine test',
    canvas: canvasFromPreset(requirePreset('social-square')),
    now: NOW,
  });
}

function box(id: string, x = 0, y = 0) {
  return createShapeNode({
    id,
    shape: 'rect',
    x,
    y,
    width: 100,
    height: 80,
    fill: { type: 'solid', color: '#6741E8' },
  });
}

describe('document commands', () => {
  it('adds a node and appends it on top', () => {
    const first = addNode(emptyDocument(), box('a'));
    expect(first.nodes).toHaveLength(1);

    const second = addNode(first, box('b'));
    expect(second.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(second.updatedAt).not.toBe(NOW.toISOString());
  });

  it('refuses to exceed the node ceiling', () => {
    const document = emptyDocument();
    const many = [...document.nodes];
    for (let index = 0; index < 150; index += 1) many.push(box(`n${index}`));
    const full = { ...document, nodes: many };

    expect(() => addNode(full, box('overflow'))).toThrow(/cannot hold more than/);
  });

  it('removes nodes and leaves others untouched', () => {
    const document = addNodes(emptyDocument(), [box('a'), box('b')]);
    const next = removeNodes(document, ['a']);
    expect(next.nodes.map((node) => node.id)).toEqual(['b']);
    expect(removeNodes(next, ['missing'])).toBe(next);
  });

  it('updates a node without touching its siblings', () => {
    const document = addNodes(emptyDocument(), [box('a'), box('b')]);
    const next = updateNode(document, 'a', { x: 500 });
    expect(next.nodes[0]?.x).toBe(500);
    expect(next.nodes[1]?.x).toBe(0);
  });

  it('returns the same document for an unknown id', () => {
    const document = emptyDocument();
    expect(updateNode(document, 'nope', { x: 10 })).toBe(document);
  });

  it('duplicates with fresh ids and an offset', () => {
    const document = addNode(emptyDocument(), box('a', 10, 10));
    const result = duplicateNodes(document, ['a']);

    expect(result.createdIds).toHaveLength(1);
    const copy = result.document.nodes[1];
    expect(copy?.id).not.toBe('a');
    expect(copy?.x).toBe(34);
    expect(result.document.nodes).toHaveLength(2);
  });

  it('moves a selection by a delta', () => {
    const document = addNodes(emptyDocument(), [box('a', 0, 0), box('b', 200, 200)]);
    const next = moveNodes(document, ['a', 'b'], { x: 10, y: -10 });
    expect(next.nodes[0]).toMatchObject({ x: 10, y: -10 });
    expect(next.nodes[1]).toMatchObject({ x: 210, y: 190 });
  });

  it('reorders a node front, back, forward and backward', () => {
    const document = addNodes(emptyDocument(), [box('a'), box('b'), box('c')]);

    expect(reorderNode(document, 'a', 'front').nodes.map((n) => n.id)).toEqual(['b', 'c', 'a']);
    expect(reorderNode(document, 'c', 'back').nodes.map((n) => n.id)).toEqual(['c', 'a', 'b']);
    expect(reorderNode(document, 'a', 'forward').nodes.map((n) => n.id)).toEqual(['b', 'a', 'c']);
    expect(reorderNode(document, 'b', 'backward').nodes.map((n) => n.id)).toEqual(['b', 'a', 'c']);
  });

  it('groups a selection and keeps the members', () => {
    const document = addNodes(emptyDocument(), [box('a', 0, 0), box('b', 200, 0)]);
    const result = groupNodes(document, ['a', 'b']);

    expect(result.groupId).not.toBeNull();
    expect(result.document.nodes).toHaveLength(1);
    const group = result.document.nodes[0];
    expect(group?.type).toBe('group');
    expect(group?.width).toBe(300);
  });

  it('refuses to group a single node', () => {
    const document = addNode(emptyDocument(), box('a'));
    const result = groupNodes(document, ['a']);
    expect(result.groupId).toBeNull();
    expect(result.document).toBe(document);
  });

  it('aligns a single node to the canvas', () => {
    const document = addNode(emptyDocument(), box('a', 10, 10));
    const next = alignSelection(document, ['a'], 'left');
    expect(next.nodes[0]?.x).toBe(0);
  });

  it('creates a text node with sane defaults', () => {
    const node = createTextNode({
      text: 'Hello',
      x: 0,
      y: 0,
      width: 300,
      fontSize: 48,
      color: '#000000',
    });
    expect(node.type).toBe('text');
    expect(node.fontFamily).toBe('sans');
    expect(node.height).toBeGreaterThanOrEqual(48);
    expect(node.locked).toBe(false);
  });

  it('creates an image node referencing an asset id only', () => {
    const node = createImageNode({
      assetId: 'a1',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(node.assetId).toBe('a1');
    expect(node).not.toHaveProperty('src');
  });
});

describe('document history', () => {
  it('undoes and redoes through whole states', () => {
    const history = new DocumentHistory(emptyDocument());
    const first = addNode(history.current, box('a'));
    history.commit(first);

    expect(history.canUndo).toBe(true);
    expect(history.undo()?.nodes).toHaveLength(0);
    expect(history.canRedo).toBe(true);
    expect(history.redo()?.nodes).toHaveLength(1);
  });

  it('does nothing when the document is unchanged', () => {
    const history = new DocumentHistory(emptyDocument());
    history.commit(history.current);
    expect(history.canUndo).toBe(false);
  });

  it('drops the redo branch on a new commit', () => {
    const history = new DocumentHistory(emptyDocument());
    history.commit(addNode(history.current, box('a')));
    history.undo();
    history.commit(addNode(history.current, box('b')));

    expect(history.canRedo).toBe(false);
  });

  it('coalesces a gesture into one entry', () => {
    const history = new DocumentHistory(emptyDocument());
    history.beginGesture('drag:a');

    let current = addNode(history.current, box('a'));
    for (const dx of [1, 2, 3, 4, 5]) {
      current = moveNodes(current, ['a'], { x: dx, y: 0 });
      history.commit(current, { key: 'drag:a' });
    }
    history.endGesture();

    expect(history.depth).toBe(1);
    expect(history.canUndo).toBe(true);
    expect(history.undo()?.nodes).toHaveLength(0);
  });

  it('respects the history limit', () => {
    const history = new DocumentHistory(emptyDocument(), { limit: 5 });
    let current = history.current;
    for (let index = 0; index < 20; index += 1) {
      current = addNode(current, box(`n${index}`));
      history.commit(current);
    }
    expect(history.depth).toBe(5);
  });

  it('returns null when there is nothing to undo or redo', () => {
    const history = new DocumentHistory(emptyDocument());
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('resets the stack when a document is loaded', () => {
    const history = new DocumentHistory(emptyDocument());
    history.commit(addNode(history.current, box('a')));
    history.reset(emptyDocument());

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.current.nodes).toHaveLength(0);
  });
});

describe('locked layers (L4)', () => {
  it('refuses to delete a locked node', () => {
    const document = addNodes(emptyDocument(), [box('a'), { ...box('b'), locked: true }]);
    const next = removeNodes(document, ['a', 'b']);

    expect(next.nodes.map((node) => node.id)).toEqual(['b']);
  });

  it('refuses to move a locked node', () => {
    const document = addNodes(emptyDocument(), [
      box('a', 0, 0),
      { ...box('b', 0, 0), locked: true },
    ]);
    const next = moveNodes(document, ['a', 'b'], { x: 50, y: 0 });

    expect(next.nodes[0]?.x).toBe(50);
    expect(next.nodes[1]?.x).toBe(0);
  });

  it('returns the same document when every target is locked', () => {
    const document = addNodes(emptyDocument(), [{ ...box('a'), locked: true }]);
    expect(removeNodes(document, ['a'])).toBe(document);
    expect(moveNodes(document, ['a'], { x: 5, y: 5 })).toBe(document);
  });
});

describe('document pixel placement (M1)', () => {
  it('aligns a single node to the right edge of an A4 document', () => {
    // A4 at 300 DPI is 2480 px wide; the node is 100 px wide.
    const document = addNode(emptyA4Document(), box('a', 0, 0));
    const next = alignSelection(document, ['a'], 'right');

    expect(next.nodes[0]?.x).toBeCloseTo(2380.315, 2);
  });

  it('aligns a single node to the vertical centre of an A4 document', () => {
    const document = addNode(emptyA4Document(), box('a', 0, 0));
    const next = alignSelection(document, ['a'], 'middle');

    // A4 is 3508 px tall at 300 DPI.
    expect(next.nodes[0]?.y).toBeCloseTo((3508 - 80) / 2, 0);
  });

  it('aligns to the edge of the selection when several nodes are selected', () => {
    const document = addNodes(emptyA4Document(), [box('a', 100, 100), box('b', 400, 100)]);
    const next = alignSelection(document, ['a', 'b'], 'left');

    expect(next.nodes[0]?.x).toBe(100);
    expect(next.nodes[1]?.x).toBe(100);
  });
});

function emptyA4Document() {
  return createCreativeDocument({
    title: 'A4 test',
    canvas: {
      unit: 'mm',
      width: 210,
      height: 297,
      dpi: 300,
      background: { type: 'solid', color: '#ffffff' },
    },
    now: NOW,
  });
}
