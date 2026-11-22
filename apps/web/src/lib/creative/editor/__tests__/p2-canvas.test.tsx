import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  canvasFromPreset,
  createCreativeDocument,
  requirePreset,
  type CreativeDocument,
} from '@quickbiz/shared';
import { useStudioEditor } from '../use-studio-editor';
import type { CreativeProjectStore } from '../../storage/project-store';

function doc(): CreativeDocument {
  return createCreativeDocument({
    title: 'Canvas test',
    canvas: canvasFromPreset(requirePreset('a4-portrait')),
    now: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function setup() {
  const store: CreativeProjectStore = {
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
    async put() {},
    async remove() {},
  };

  const initial = doc();
  const hook = renderHook(() =>
    useStudioEditor({ projectId: initial.id, initial, store, autosaveDelayMs: 100_000 }),
  );
  return hook;
}

describe('canvas settings (P2)', () => {
  it('changes the page background through a document command', () => {
    const { result } = setup();

    act(() => {
      result.current.updateCanvas({ background: { type: 'solid', color: '#0E1526' } });
    });

    expect(result.current.document.canvas.background).toEqual({
      type: 'solid',
      color: '#0E1526',
    });
    expect(result.current.canUndo).toBe(true);
  });

  it('keeps the canvas size and DPI when only the background changes', () => {
    const { result } = setup();
    const before = result.current.document.canvas;

    act(() => {
      result.current.updateCanvas({ background: { type: 'solid', color: '#FFFFFF' } });
    });

    const after = result.current.document.canvas;
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    expect(after.dpi).toBe(before.dpi);
    expect(after.unit).toBe(before.unit);
  });

  it('undoes a background change', () => {
    const { result } = setup();

    act(() => {
      result.current.updateCanvas({ background: { type: 'solid', color: '#FF0000' } });
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.document.canvas.background.type).toBe('solid');
    expect(
      (result.current.document.canvas.background as { color: string }).color.toLowerCase(),
    ).toBe('#ffffff');
  });
});
