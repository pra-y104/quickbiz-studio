/**
 * Pure geometry for the editor.
 *
 * Everything here works on document coordinates (document pixels) and has no
 * React or canvas dependency, so it can be tested directly. Rotation is always
 * about a node's centre, which is what the renderer does too — keeping the two in
 * agreement is the only way hit-testing stays correct.
 */

import type { CreativeNode } from '@quickbiz/shared';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const RESIZE_HANDLES: readonly ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function rotatePoint(point: Point, origin: Point, degrees: number): Point {
  if (degrees === 0) return point;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

export function nodeCenter(node: CreativeNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

/** Document point expressed in the node's unrotated frame. */
export function toLocalPoint(node: CreativeNode, point: Point): Point {
  return rotatePoint(point, nodeCenter(node), -node.rotation);
}

export function toDocumentPoint(node: CreativeNode, local: Point): Point {
  return rotatePoint(local, nodeCenter(node), node.rotation);
}

/** True when a document point falls inside the node, rotation included. */
export function hitTestNode(node: CreativeNode, point: Point): boolean {
  if (node.hidden) return false;
  const local = toLocalPoint(node, point);
  return (
    local.x >= node.x &&
    local.x <= node.x + node.width &&
    local.y >= node.y &&
    local.y <= node.y + node.height
  );
}

/**
 * Topmost node under the pointer.
 *
 * Locked nodes are skipped so a locked background shape cannot steal a click from
 * the text above it. Groups are returned whole; their children are not
 * individually selectable in this version.
 */
export function hitTest(nodes: readonly CreativeNode[], point: Point): CreativeNode | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (!node || node.locked) continue;
    if (hitTestNode(node, point)) return node;
  }
  return null;
}

export interface NodeBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned bounding box of one or more nodes, after rotation. */
export function boundsOf(nodes: readonly CreativeNode[]): NodeBounds | null {
  if (nodes.length === 0) return null;

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const center = nodeCenter(node);
    const corners: Point[] = [
      { x: node.x, y: node.y },
      { x: node.x + node.width, y: node.y },
      { x: node.x + node.width, y: node.y + node.height },
      { x: node.x, y: node.y + node.height },
    ].map((corner) => rotatePoint(corner, center, node.rotation));

    for (const corner of corners) {
      left = Math.min(left, corner.x);
      top = Math.min(top, corner.y);
      right = Math.max(right, corner.x);
      bottom = Math.max(bottom, corner.y);
    }
  }

  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface ResizeResult {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Resize a node by dragging one handle.
 *
 * The pointer is projected into the node's own axes, so resizing a rotated node
 * behaves the way the customer expects rather than jumping.
 */
export function resizeNode(
  node: CreativeNode,
  handle: ResizeHandle,
  pointer: Point,
  options: { readonly keepAspect?: boolean; readonly minimum?: number } = {},
): ResizeResult {
  const minimum = options.minimum ?? 8;
  const local = toLocalPoint(node, pointer);

  const originalRight = node.x + node.width;
  const originalBottom = node.y + node.height;

  let left = node.x;
  let top = node.y;
  let right = originalRight;
  let bottom = originalBottom;

  if (handle.includes('w')) left = clamp(local.x, node.x - node.width * 4, originalRight - minimum);
  if (handle.includes('e')) right = clamp(local.x, node.x + minimum, node.x + node.width * 5);
  if (handle.includes('n'))
    top = clamp(local.y, node.y - node.height * 4, originalBottom - minimum);
  if (handle.includes('s')) bottom = clamp(local.y, node.y + minimum, node.y + node.height * 5);

  let width = Math.max(minimum, right - left);
  let height = Math.max(minimum, bottom - top);

  if (options.keepAspect && handle.length === 2 && node.width > 0 && node.height > 0) {
    const ratio = node.width / node.height;
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;

    if (handle.includes('w')) left = originalRight - width;
    if (handle.includes('n')) top = originalBottom - height;
  }

  return { x: left, y: top, width, height };
}

/** Corner and edge handle positions in document space, rotation included. */
export function handlePoints(node: CreativeNode): Readonly<Record<ResizeHandle, Point>> {
  const corners: Record<ResizeHandle, Point> = {
    nw: { x: node.x, y: node.y },
    n: { x: node.x + node.width / 2, y: node.y },
    ne: { x: node.x + node.width, y: node.y },
    e: { x: node.x + node.width, y: node.y + node.height / 2 },
    se: { x: node.x + node.width, y: node.y + node.height },
    s: { x: node.x + node.width / 2, y: node.y + node.height },
    sw: { x: node.x, y: node.y + node.height },
    w: { x: node.x, y: node.y + node.height / 2 },
  };

  const center = nodeCenter(node);
  const result = {} as Record<ResizeHandle, Point>;
  for (const handle of RESIZE_HANDLES) {
    result[handle] = rotatePoint(corners[handle], center, node.rotation);
  }
  return result;
}

/** Point above the top edge used as the rotation handle. */
export function rotateHandlePoint(node: CreativeNode, offset = 28): Point {
  const top = toDocumentPoint(node, { x: node.x + node.width / 2, y: node.y });
  const radians = ((node.rotation - 90) * Math.PI) / 180;
  return {
    x: top.x + Math.cos(radians) * offset,
    y: top.y + Math.sin(radians) * offset,
  };
}

/** Angle in degrees between the node centre and a document point. */
export function angleForRotation(node: CreativeNode, point: Point): number {
  const center = nodeCenter(node);
  const radians = Math.atan2(point.y - center.y, point.x - center.x);
  return (radians * 180) / Math.PI + 90;
}

export function normaliseRotation(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Axis-aligned rectangle from two corners, used by marquee selection. */
export function rectFromPoints(a: Point, b: Point): NodeBounds {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function boundsIntersect(a: NodeBounds, b: NodeBounds): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/** Distribute or align a set of nodes against a reference rectangle. */
export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export function alignNodes(
  nodes: readonly CreativeNode[],
  mode: AlignMode,
  reference: NodeBounds,
): Readonly<Record<string, Point>> {
  const offsets: Record<string, Point> = {};

  for (const node of nodes) {
    const bounds = boundsOf([node]);
    if (!bounds) continue;
    let dx = 0;
    let dy = 0;

    switch (mode) {
      case 'left':
        dx = reference.left - bounds.left;
        break;
      case 'center':
        dx = reference.left + reference.width / 2 - (bounds.left + bounds.width / 2);
        break;
      case 'right':
        dx = reference.right - bounds.right;
        break;
      case 'top':
        dy = reference.top - bounds.top;
        break;
      case 'middle':
        dy = reference.top + reference.height / 2 - (bounds.top + bounds.height / 2);
        break;
      case 'bottom':
        dy = reference.bottom - bounds.bottom;
        break;
    }

    offsets[node.id] = { x: node.x + dx, y: node.y + dy };
  }

  return offsets;
}

export function snapValue(value: number, targets: readonly number[], threshold: number): number {
  let best = value;
  let bestDistance = threshold + 1;
  for (const target of targets) {
    const distance = Math.abs(target - value);
    if (distance <= threshold && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}
