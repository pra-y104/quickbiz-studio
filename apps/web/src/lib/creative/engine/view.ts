/**
 * Viewport maths for the canvas stage.
 *
 * Kept out of the React component so it can be tested directly and so the module
 * only exports components (fast-refresh friendly).
 */

import type { CreativeNode } from '@quickbiz/shared';
import { boundsIntersect, clamp, rectFromPoints, type Point } from './geometry';

export const MIN_ZOOM_FACTOR = 0.5;
export const MAX_ZOOM_FACTOR = 4;
export const MIN_SCALE = 0.02;
export const MAX_SCALE = 8;

export function clampZoomFactor(factor: number): number {
  return clamp(factor, MIN_ZOOM_FACTOR, MAX_ZOOM_FACTOR);
}

export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** Which nodes a marquee from `start` to `end` would select. */
export function marqueeSelection(
  nodes: readonly CreativeNode[],
  start: Point,
  end: Point,
): readonly string[] {
  return nodes
    .filter((node) =>
      boundsIntersect(rectFromPoints(start, end), {
        left: node.x,
        top: node.y,
        right: node.x + node.width,
        bottom: node.y + node.height,
        width: node.width,
        height: node.height,
      }),
    )
    .map((node) => node.id);
}

/**
 * Pan needed to keep a document point under a viewport point after the scale
 * changes. Used by pinch zoom so the image does not drift under the fingers.
 */
export function panForAnchoredZoom(options: {
  readonly pan: Point;
  readonly anchor: Point;
  readonly fromScale: number;
  readonly toScale: number;
  readonly centreDelta: Point;
}): Point {
  const { pan, anchor, fromScale, toScale, centreDelta } = options;
  return {
    x: pan.x + centreDelta.x + anchor.x * (fromScale - toScale),
    y: pan.y + centreDelta.y + anchor.y * (fromScale - toScale),
  };
}

/** Clamp a pan offset so the artboard cannot be lost off-screen. */
export function clampPan(
  pan: Point,
  canvasSize: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  slack = 32,
): Point {
  const maxX = Math.max(0, (canvasSize.width - viewport.width) / 2 + slack);
  const maxY = Math.max(0, (canvasSize.height - viewport.height) / 2 + slack);
  return { x: clamp(pan.x, -maxX, maxX), y: clamp(pan.y, -maxY, maxY) };
}
