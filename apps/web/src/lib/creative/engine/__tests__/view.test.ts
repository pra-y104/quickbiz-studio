import { describe, expect, it } from 'vitest';
import type { CreativeNode } from '@quickbiz/shared';
import {
  clampPan,
  clampScale,
  clampZoomFactor,
  marqueeSelection,
  panForAnchoredZoom,
} from '../view';

function box(id: string, x: number, y: number, width = 100, height = 80): CreativeNode {
  return {
    id,
    type: 'shape',
    name: id,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    shape: 'rect',
    fill: { type: 'solid', color: '#000000' },
    stroke: null,
    cornerRadius: 0,
  } as CreativeNode;
}

describe('zoom limits', () => {
  it('clamps the zoom factor to the supported range', () => {
    expect(clampZoomFactor(0.1)).toBe(0.5);
    expect(clampZoomFactor(2)).toBe(2);
    expect(clampZoomFactor(99)).toBe(4);
  });

  it('clamps the absolute canvas scale', () => {
    expect(clampScale(0.0001)).toBe(0.02);
    expect(clampScale(100)).toBe(8);
  });
});

describe('marquee selection', () => {
  const nodes = [box('a', 0, 0), box('b', 300, 0), box('c', 600, 0)];

  it('selects nodes the rectangle touches', () => {
    expect(marqueeSelection(nodes, { x: -20, y: -20 }, { x: 150, y: 120 })).toEqual(['a']);
  });

  it('selects several nodes in one rectangle', () => {
    expect(marqueeSelection(nodes, { x: -20, y: -20 }, { x: 450, y: 120 })).toEqual(['a', 'b']);
  });

  it('selects nothing for an empty rectangle in empty space', () => {
    expect(marqueeSelection(nodes, { x: 2_000, y: 2_000 }, { x: 2_100, y: 2_100 })).toEqual([]);
  });

  it('is independent of drag direction', () => {
    expect(marqueeSelection(nodes, { x: 450, y: 120 }, { x: -20, y: -20 })).toEqual(['a', 'b']);
  });
});

describe('pan for anchored zoom', () => {
  it('keeps the anchor fixed when the scale doubles', () => {
    const pan = panForAnchoredZoom({
      pan: { x: 0, y: 0 },
      anchor: { x: 200, y: 100 },
      fromScale: 0.5,
      toScale: 1,
      centreDelta: { x: 0, y: 0 },
    });

    // The anchor must stay under the same viewport point:
    // anchor * fromScale === pan + anchor * toScale  →  pan = -anchor * (to - from)
    expect(pan.x).toBeCloseTo(-100, 5);
    expect(pan.y).toBeCloseTo(-50, 5);
  });

  it('adds the midpoint movement of the gesture', () => {
    const pan = panForAnchoredZoom({
      pan: { x: 10, y: 20 },
      anchor: { x: 0, y: 0 },
      fromScale: 1,
      toScale: 1,
      centreDelta: { x: 30, y: -10 },
    });

    expect(pan).toEqual({ x: 40, y: 10 });
  });
});

describe('pan clamping', () => {
  it('leaves a small canvas alone', () => {
    const pan = clampPan({ x: 0, y: 0 }, { width: 400, height: 400 }, { width: 800, height: 800 });
    expect(pan).toEqual({ x: 0, y: 0 });
  });

  it('bounds the pan so the artboard cannot be lost', () => {
    const pan = clampPan(
      { x: 5_000, y: -5_000 },
      { width: 4_000, height: 4_000 },
      { width: 800, height: 600 },
    );
    expect(pan.x).toBeLessThanOrEqual((4_000 - 800) / 2 + 32);
    expect(pan.y).toBeGreaterThanOrEqual(-((4_000 - 600) / 2 + 32));
  });
});
