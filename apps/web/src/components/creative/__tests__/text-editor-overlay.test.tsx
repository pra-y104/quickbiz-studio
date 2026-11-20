import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { TextEditorOverlay } from '../text-editor-overlay';
import type { CreativeTextNode } from '@quickbiz/shared';

function textNode(overrides: Partial<CreativeTextNode> = {}): CreativeTextNode {
  return {
    id: 'n1',
    type: 'text',
    name: 'Headline',
    x: 40,
    y: 60,
    width: 320,
    height: 90,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: 'Hello',
    fontFamily: 'sans',
    fontSize: 48,
    fontWeight: 700,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.15,
    letterSpacing: 0,
    color: '#0B1222',
    verticalAlign: 'top',
    ...overrides,
  };
}

/** The overlay positions itself from the canvas rect, so a canvas must exist. */
function attachCanvas() {
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 20,
      width: 540,
      height: 540,
      right: 550,
      bottom: 560,
      x: 10,
      y: 20,
    }) as DOMRect;
  document.body.append(canvas);
  return canvas;
}

function setup(node = textNode()) {
  const canvas = attachCanvas();
  const canvasRef = createRef<HTMLCanvasElement>();
  (canvasRef as { current: HTMLCanvasElement | null }).current = canvas;

  const onPreview = vi.fn();
  const onCommit = vi.fn();
  const onCancel = vi.fn();

  render(
    <TextEditorOverlay
      node={node}
      scale={0.5}
      canvasRef={canvasRef}
      onPreview={onPreview}
      onCommit={onCommit}
      onCancel={onCancel}
    />,
  );

  return { onPreview, onCommit, onCancel };
}

describe('TextEditorOverlay (P0.2)', () => {
  it('opens with the node text and asks for focus', () => {
    const focusSpy = vi.spyOn(HTMLTextAreaElement.prototype, 'focus');
    setup();

    const textarea = screen.getByLabelText(/edit text/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Hello');
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it('previews edits without committing', () => {
    const { onPreview, onCommit } = setup();

    const textarea = screen.getByLabelText(/edit text/i);
    fireEvent.change(textarea, { target: { value: 'Hello world' } });

    expect(onPreview).toHaveBeenCalledWith('Hello world');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits on blur', () => {
    const { onCommit } = setup();

    const textarea = screen.getByLabelText(/edit text/i);
    fireEvent.change(textarea, { target: { value: 'Changed' } });
    fireEvent.blur(textarea);

    expect(onCommit).toHaveBeenCalledWith('Changed');
  });

  it('cancels on Escape without committing', () => {
    const { onCommit, onCancel } = setup();

    const textarea = screen.getByLabelText(/edit text/i);
    fireEvent.change(textarea, { target: { value: 'Discard me' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits with Ctrl+Enter', () => {
    const { onCommit } = setup();

    const textarea = screen.getByLabelText(/edit text/i);
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(onCommit).toHaveBeenCalledWith('Hello');
  });
});
