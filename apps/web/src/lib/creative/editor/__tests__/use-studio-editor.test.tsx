import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  canvasFromPreset,
  createCreativeDocument,
  requirePreset,
  type CreativeDocument,
} from '@quickbiz/shared';
import { createInMemoryProjectStore } from '../../storage/project-store';
import { useStudioEditor } from '../use-studio-editor';

function document(title: string): CreativeDocument {
  return createCreativeDocument({
    title,
    canvas: canvasFromPreset(requirePreset('social-square')),
    now: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function setup(initial: CreativeDocument) {
  const store = createInMemoryProjectStore();
  return renderHook(
    ({ document: value }: { document: CreativeDocument }) =>
      useStudioEditor({ projectId: value.id, initial: value, store, autosaveDelayMs: 100_000 }),
    { initialProps: { document: initial } },
  );
}

describe('useStudioEditor project switching (H4)', () => {
  it('resets to the new document when the project changes', () => {
    const first = document('First design');
    const second = document('Second design');

    const { result, rerender } = setup(first);

    act(() => {
      result.current.addText({ text: 'An edit in the first design' });
    });

    expect(result.current.document.nodes).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);

    rerender({ document: second });

    expect(result.current.document.title).toBe('Second design');
    expect(result.current.document.id).toBe(second.id);
    expect(result.current.document.nodes).toHaveLength(0);
    expect(result.current.selection).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
  });

  it('does not carry an undo stack across projects', () => {
    const first = document('First design');
    const second = document('Second design');

    const { result, rerender } = setup(first);
    act(() => {
      result.current.addText({ text: 'Only in the first design' });
    });

    rerender({ document: second });

    act(() => {
      result.current.undo();
    });

    // Undo must be a no-op in the new project rather than restoring old content.
    expect(result.current.document.title).toBe('Second design');
    expect(result.current.document.nodes).toHaveLength(0);
  });

  it('keeps editing the same document when the project is unchanged', () => {
    const first = document('Same design');
    const { result } = setup(first);

    act(() => {
      result.current.addText({ text: 'Still here' });
    });

    expect(result.current.document.title).toBe('Same design');
    expect(result.current.document.nodes).toHaveLength(1);
  });
});
describe('layer actions target one layer (H3)', () => {
  function withTwoShapes() {
    const first = document('Two layers');
    const hook = setup(first);
    let firstId = '';
    let secondId = '';

    act(() => {
      firstId = hook.result.current.addShape('rect');
    });
    act(() => {
      secondId = hook.result.current.addShape('rect');
    });
    act(() => {
      hook.result.current.select([firstId, secondId]);
    });

    return { ...hook, firstId, secondId };
  }

  it('hides only the layer that was clicked', () => {
    const { result, secondId } = withTwoShapes();

    act(() => {
      result.current.toggleHidden(secondId);
    });

    const nodes = result.current.document.nodes;
    const second = nodes.find((node) => node.id === secondId);
    expect(second?.hidden).toBe(true);
    expect(nodes.filter((node) => node.hidden)).toHaveLength(1);
  });

  it('locks only the layer that was clicked', () => {
    const { result, secondId } = withTwoShapes();

    act(() => {
      result.current.toggleLocked(secondId);
    });

    const nodes = result.current.document.nodes;
    expect(nodes.filter((node) => node.locked)).toHaveLength(1);
    expect(nodes.find((node) => node.id === secondId)?.locked).toBe(true);
  });

  it('deleting one layer cannot delete another selected layer', () => {
    const { result, firstId, secondId } = withTwoShapes();

    act(() => {
      result.current.deleteNodes([secondId]);
    });

    const ids = result.current.document.nodes.map((node) => node.id);
    expect(ids).toEqual([firstId]);
    expect(ids).not.toContain(secondId);
  });
});
