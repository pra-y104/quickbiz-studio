import { describe, expect, it, vi } from 'vitest';
import {
  canvasFromPreset,
  createCreativeDocument,
  createDocumentFromTemplate,
  requirePreset,
  type CreativeDocument,
} from '@quickbiz/shared';
import { renderDocument, selectionBounds } from '../render/render-document';

/**
 * A recording 2D context.
 *
 * jsdom has no canvas implementation, so the renderer is exercised against a stub
 * that records calls. That is enough to prove every node type draws without
 * throwing, and that the export path produces a sane number of operations.
 */
function createStubContext() {
  const calls: string[] = [];

  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.length})`);
    };

  const gradient = { addColorStop: record('addColorStop') };

  const context = {
    canvas: { width: 1080, height: 1080 },
    calls,
    save: record('save'),
    restore: record('restore'),
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    rect: record('rect'),
    roundRect: record('roundRect'),
    ellipse: record('ellipse'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    fill: record('fill'),
    stroke: record('stroke'),
    arc: record('arc'),
    translate: record('translate'),
    rotate: record('rotate'),
    clip: record('clip'),
    drawImage: record('drawImage'),
    fillText: record('fillText'),
    measureText: (text: string) => ({ width: text.length * 20 }),
    createLinearGradient: (...args: unknown[]) => {
      calls.push(`createLinearGradient(${args.length})`);
      return gradient;
    },
    setLineDash: record('setLineDash'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    globalAlpha: 1,
    textBaseline: 'top',
    letterSpacing: '0px',
  };

  return context;
}

function documentWithNodes(): CreativeDocument {
  const base = createDocumentFromTemplate('social-1');
  return { ...base };
}

describe('renderDocument', () => {
  it('draws a document with text, shapes and a group', () => {
    const context = createStubContext();
    const document = documentWithNodes();

    expect(() =>
      renderDocument(context as unknown as CanvasRenderingContext2D, document),
    ).not.toThrow();
    expect(context.calls).toContain('fillRect(4)');
    expect(context.calls.length).toBeGreaterThan(5);
  });

  it('draws nothing but the background for an empty document', () => {
    const context = createStubContext();
    const document = createCreativeDocument({
      title: 'Empty',
      canvas: canvasFromPreset(requirePreset('social-square')),
    });

    renderDocument(context as unknown as CanvasRenderingContext2D, document);
    expect(context.calls.filter((call) => call.startsWith('fillRect'))).toHaveLength(1);
  });

  it('draws a placeholder for an image with no asset', () => {
    const context = createStubContext();
    const document = createCreativeDocument({
      title: 'Image',
      canvas: canvasFromPreset(requirePreset('social-square')),
      nodes: [
        {
          id: 'img',
          type: 'image',
          name: 'Photo',
          x: 100,
          y: 100,
          width: 300,
          height: 300,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          assetId: 'missing',
          fit: 'cover',
          crop: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    });

    expect(() =>
      renderDocument(context as unknown as CanvasRenderingContext2D, document),
    ).not.toThrow();
    expect(context.calls.filter((call) => call.startsWith('strokeRect'))).toHaveLength(1);
  });

  it('draws a linear gradient fill', () => {
    const context = createStubContext();
    const document = createCreativeDocument({
      title: 'Gradient',
      canvas: {
        unit: 'px',
        width: 400,
        height: 400,
        dpi: 96,
        background: { type: 'linear', from: '#000000', to: '#ffffff', angle: 45 },
      },
    });

    renderDocument(context as unknown as CanvasRenderingContext2D, document);
    expect(context.calls).toContain('createLinearGradient(4)');
  });

  it('can omit the background for a transparent export', () => {
    const context = createStubContext();
    const document = createCreativeDocument({
      title: 'Transparent',
      canvas: canvasFromPreset(requirePreset('social-square')),
    });

    renderDocument(context as unknown as CanvasRenderingContext2D, document, {
      skipBackground: true,
    });

    expect(context.calls.filter((call) => call.startsWith('fillRect'))).toHaveLength(0);
  });

  it('draws a selection outline only when asked', () => {
    const withSelection = createStubContext();
    const document = documentWithNodes();
    const ids = [document.nodes[0]?.id ?? 'missing'];

    renderDocument(withSelection as unknown as CanvasRenderingContext2D, document, {
      selection: ids,
      showSelection: true,
    });
    expect(withSelection.calls.filter((call) => call.startsWith('strokeRect'))).not.toHaveLength(0);

    const withoutSelection = createStubContext();
    renderDocument(withoutSelection as unknown as CanvasRenderingContext2D, document);
    expect(withoutSelection.calls.filter((call) => call.startsWith('strokeRect'))).toHaveLength(0);
  });

  it('reports the selection bounds', () => {
    const document = documentWithNodes();
    const [node] = document.nodes;
    expect(node).toBeDefined();

    const bounds = selectionBounds(document, [node?.id ?? 'missing']);
    expect(bounds).not.toBeNull();
    expect(bounds?.width).toBeGreaterThan(0);

    expect(selectionBounds(document, [])).toBeNull();
    expect(selectionBounds(document, ['unknown'])).toBeNull();
  });

  it('does not mutate the document while rendering', () => {
    const document = documentWithNodes();
    const before = JSON.stringify(document);
    renderDocument(createStubContext() as unknown as CanvasRenderingContext2D, document);
    expect(JSON.stringify(document)).toBe(before);
  });
});

describe('renderer determinism', () => {
  it('produces the same call count for the same document', () => {
    const first = createStubContext();
    const second = createStubContext();
    const document = documentWithNodes();

    renderDocument(first as unknown as CanvasRenderingContext2D, document);
    renderDocument(second as unknown as CanvasRenderingContext2D, document);

    expect(first.calls.length).toBe(second.calls.length);
  });

  it('is not affected by a spy on Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const context = createStubContext();
    renderDocument(context as unknown as CanvasRenderingContext2D, documentWithNodes());
    spy.mockRestore();
    expect(context.calls.length).toBeGreaterThan(0);
  });
});
