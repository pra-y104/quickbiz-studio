import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  canvasFromPreset,
  createCreativeDocument,
  requirePreset,
  type CreativeDocument,
} from '@quickbiz/shared';
import { useStudioEditor } from '../use-studio-editor';
import type { CreativeProjectRecord, CreativeProjectStore } from '../../storage/project-store';

function doc(title = 'Design'): CreativeDocument {
  return createCreativeDocument({
    title,
    canvas: canvasFromPreset(requirePreset('social-square')),
    now: new Date('2026-01-01T00:00:00.000Z'),
  });
}

/** Let pending timers and promises settle inside act(). */
async function flush(ms = 40): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** Immediate store that records every write in order. */
function createRecordingStore() {
  const writes: CreativeProjectRecord[] = [];

  const store: CreativeProjectStore = {
    persistent: false,
    async list() {
      return writes.map((record) => ({
        id: record.id,
        title: record.title,
        updatedAt: record.updatedAt,
        createdAt: record.createdAt,
        nodeCount: record.document.nodes.length,
        presetLabel: '1080 × 1080 px',
      }));
    },
    async get(id) {
      return writes.filter((record) => record.id === id).at(-1) ?? null;
    },
    async all() {
      return [...writes];
    },
    async put(record) {
      writes.push(record);
    },
    async remove(id) {
      const index = writes.findIndex((record) => record.id === id);
      if (index >= 0) writes.splice(index, 1);
    },
  };

  return { store, writes };
}

/**
 * Render the hook with a *stable* initial document.
 *
 * The document must be created once: the editor resets itself when the incoming
 * document id changes, so passing a freshly built object on every render would
 * look like a project switch and loop.
 */
function setup(autosaveDelayMs: number, store: CreativeProjectStore, initial = doc()) {
  return renderHook(() => useStudioEditor({ projectId: 'p1', initial, store, autosaveDelayMs }));
}

describe('autosave (P0.1)', () => {
  it('debounces rapid edits into one trailing write', async () => {
    const { store, writes } = createRecordingStore();
    const { result } = setup(5, store);

    act(() => {
      result.current.addText({ text: 'one' });
      result.current.addText({ text: 'two' });
      result.current.addText({ text: 'three' });
    });

    await flush();

    expect(writes).toHaveLength(1);
    expect(writes[0]?.document.nodes).toHaveLength(3);
  });

  it('persists the newest document, never an older snapshot', async () => {
    const { store, writes } = createRecordingStore();
    const { result } = setup(5, store);

    act(() => {
      result.current.addText({ text: 'first' });
    });
    await flush();

    act(() => {
      result.current.addText({ text: 'second' });
    });
    await flush();

    expect(writes.length).toBeGreaterThanOrEqual(2);

    const first = writes[0];
    const last = writes[writes.length - 1];

    expect(first?.document.nodes).toHaveLength(1);
    expect(last?.document.nodes).toHaveLength(2);
    const firstAt = Date.parse(first?.document.updatedAt ?? '');
    const lastAt = Date.parse(last?.document.updatedAt ?? '');
    expect(lastAt).toBeGreaterThanOrEqual(firstAt);
  });

  it('reports saved only after a successful write', async () => {
    const { store } = createRecordingStore();
    const { result } = setup(5, store);

    act(() => {
      result.current.addText({ text: 'saved' });
    });

    expect(result.current.saveState).toBe('saving');
    await flush();
    expect(result.current.saveState).toBe('saved');
  });

  it('reports an error when the write fails', async () => {
    const failing: CreativeProjectStore = {
      persistent: false,
      async list() {
        return [];
      },
      async get() {
        return null;
      },
      async all() {
        return [];
      },
      async put() {
        throw new Error('disk full');
      },
      async remove() {},
    };

    const { result } = setup(5, failing);

    act(() => {
      result.current.addText({ text: 'boom' });
    });
    await flush();

    expect(result.current.saveState).toBe('error');
  });
});

describe('delete counts and locked layers (P0.5)', () => {
  it('returns how many layers were removed', () => {
    const { result } = setup(100_000, createRecordingStore().store);

    let first = '';
    let second = '';
    act(() => {
      first = result.current.addShape('rect');
    });
    act(() => {
      second = result.current.addShape('rect');
    });

    act(() => {
      result.current.select([first, second]);
    });

    let removed = 0;
    act(() => {
      removed = result.current.deleteNodes([second]);
    });

    expect(removed).toBe(1);
    expect(result.current.document.nodes.map((node) => node.id)).toEqual([first]);
  });

  it('refuses to delete a locked layer and reports zero', () => {
    const { result } = setup(100_000, createRecordingStore().store);

    let id = '';
    act(() => {
      id = result.current.addShape('rect');
    });
    act(() => {
      result.current.toggleLocked(id);
    });
    act(() => {
      result.current.select([id]);
    });

    let removed = -1;
    act(() => {
      removed = result.current.deleteSelection();
    });

    expect(removed).toBe(0);
    expect(result.current.document.nodes).toHaveLength(1);
  });
});
