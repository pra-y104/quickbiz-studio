import { describe, expect, it } from 'vitest';
import {
  alignNodes,
  angleForRotation,
  boundsOf,
  hitTest,
  hitTestNode,
  normaliseRotation,
  rectFromPoints,
  resizeNode,
  rotateHandlePoint,
  rotatePoint,
  snapValue,
  toLocalPoint,
} from '../engine/geometry';
import type { CreativeNode } from '@quickbiz/shared';

function shape(overrides: Partial<CreativeNode> = {}): CreativeNode {
  return {
    id: 'n1',
    type: 'shape',
    name: 'Box',
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    shape: 'rect',
    fill: { type: 'solid', color: '#000000' },
    stroke: null,
    cornerRadius: 0,
    ...overrides,
  } as CreativeNode;
}

describe('geometry', () => {
  it('rotates a point about an origin', () => {
    const result = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(10, 5);
  });

  it('converts a document point into the node frame', () => {
    const node = shape({ rotation: 90 });
    const centre = { x: 200, y: 150 };
    const point = rotatePoint({ x: 300, y: 150 }, centre, 90);
    expect(toLocalPoint(node, point)).toEqual({ x: 300, y: 150 });
  });

  it('hit-tests the node centre and misses outside', () => {
    const node = shape();
    expect(hitTestNode(node, { x: 200, y: 150 })).toBe(true);
    expect(hitTestNode(node, { x: 50, y: 50 })).toBe(false);
  });

  it('hit-tests a rotated node correctly', () => {
    const node = shape({ rotation: 45 });
    const centre = { x: 200, y: 150 };
    // A point 50px to the right of centre lies along the rotated long axis.
    const point = rotatePoint({ x: 250, y: 150 }, centre, 45);
    expect(hitTestNode(node, point)).toBe(true);
  });

  it('skips hidden and locked nodes and returns the topmost match', () => {
    const bottom = shape({ id: 'a' });
    const top = shape({ id: 'b', y: 120 });
    const locked = shape({ id: 'c', y: 130, locked: true });

    expect(hitTest([bottom, top, locked], { x: 200, y: 140 })?.id).toBe('b');
    expect(hitTest([bottom, shape({ id: 'd', hidden: true })], { x: 200, y: 150 })?.id).toBe('a');
  });

  it('returns null when nothing is under the pointer', () => {
    expect(hitTest([shape()], { x: 0, y: 0 })).toBeNull();
  });

  it('computes an axis-aligned bounding box', () => {
    const bounds = boundsOf([shape(), shape({ id: 'n2', x: 400, y: 300 })]);
    expect(bounds).toEqual({
      left: 100,
      top: 100,
      right: 600,
      bottom: 400,
      width: 500,
      height: 300,
    });
  });

  it('grows the bounding box for a rotated node', () => {
    const bounds = boundsOf([shape({ width: 200, height: 100, rotation: 45 })]);
    expect(bounds?.width).toBeGreaterThan(200);
  });

  it('returns null for an empty selection', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('resizes from the south-east handle', () => {
    const result = resizeNode(shape(), 'se', { x: 400, y: 260 });
    expect(result).toEqual({ x: 100, y: 100, width: 300, height: 160 });
  });

  it('resizes from the north-west handle keeping the opposite corner', () => {
    const result = resizeNode(shape(), 'nw', { x: 40, y: 60 });
    expect(result.x).toBe(40);
    expect(result.y).toBe(60);
    expect(result.x + result.width).toBe(300);
    expect(result.y + result.height).toBe(200);
  });

  it('never shrinks a node below the minimum size', () => {
    const result = resizeNode(shape(), 'se', { x: 100, y: 100 });
    expect(result.width).toBeGreaterThanOrEqual(8);
    expect(result.height).toBeGreaterThanOrEqual(8);
  });

  it('keeps the aspect ratio when asked', () => {
    const node = shape({ width: 200, height: 100 });
    const result = resizeNode(node, 'se', { x: 400, y: 400 }, { keepAspect: true });
    expect(result.width / result.height).toBeCloseTo(2, 5);
  });

  it('rotates with the node frame', () => {
    const node = shape({ width: 200, height: 100, rotation: 90 });
    const corner = rotatePoint({ x: 300, y: 200 }, { x: 200, y: 150 }, 90);
    const result = resizeNode(node, 'se', corner);
    // The pointer is already on the corner, so nothing should change.
    expect(result.width).toBeCloseTo(200, 5);
    expect(result.height).toBeCloseTo(100, 5);
  });

  it('normalises rotation into 0-360', () => {
    expect(normaliseRotation(-90)).toBe(270);
    expect(normaliseRotation(450)).toBe(90);
    expect(normaliseRotation(0)).toBe(0);
  });

  it('measures the rotation angle from the top', () => {
    const node = shape();
    const above = { x: 200, y: 50 };
    expect(angleForRotation(node, above)).toBeCloseTo(0, 5);
  });

  it('places the rotation handle above the node', () => {
    const node = shape();
    const handle = rotateHandlePoint(node);
    expect(handle.y).toBeLessThan(node.y);
    expect(handle.x).toBeCloseTo(200, 5);
  });

  it('aligns nodes against a reference box', () => {
    const nodes = [shape({ id: 'a', x: 10, y: 10 }), shape({ id: 'b', x: 300, y: 400 })];
    const reference = { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 };

    const left = alignNodes(nodes, 'left', reference);
    expect(left.a?.x).toBe(0);
    expect(left.b?.x).toBe(0);

    const middle = alignNodes(nodes, 'middle', reference);
    expect(middle.a?.y).toBe(200);
  });

  it('builds a rectangle from two corners regardless of order', () => {
    const rect = rectFromPoints({ x: 100, y: 100 }, { x: 40, y: 40 });
    expect(rect).toMatchObject({ left: 40, top: 40, width: 60, height: 60 });
  });

  it('snaps to the nearest target inside the threshold', () => {
    expect(snapValue(102, [100], 6)).toBe(100);
    expect(snapValue(120, [100], 6)).toBe(120);
  });
});
