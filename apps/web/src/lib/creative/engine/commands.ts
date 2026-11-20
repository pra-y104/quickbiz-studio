/**
 * Document commands.
 *
 * Every edit is a pure function from one document to the next. Nothing here
 * touches the DOM, the canvas or React, which means:
 *
 * - undo is simply "restore the previous document",
 * - every command is unit-testable without a browser,
 * - the renderer never mutates state while drawing.
 *
 * Commands return the *same* document instance when they would change nothing,
 * so callers can skip a history entry for a no-op.
 */

import {
  CREATIVE_LIMITS,
  createNodeId,
  toDocPixels,
  type CreativeDocument,
  type CreativeNode,
  type CreativeTextNode,
  type CreativeShapeNode,
  type CreativeImageNode,
  type CreativeShapeKind,
  type CreativePaint,
  type CreativeColor,
  type FontFamilyId,
} from '@quickbiz/shared';
import type { AlignMode, ResizeHandle, Point } from './geometry';
import { alignNodes, boundsOf, resizeNode } from './geometry';

function touch(document: CreativeDocument, nodes: readonly CreativeNode[]): CreativeDocument {
  return { ...document, nodes: [...nodes], updatedAt: new Date().toISOString() };
}

function replaceNode(
  nodes: readonly CreativeNode[],
  id: string,
  update: (node: CreativeNode) => CreativeNode,
): readonly CreativeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id !== id) return node;
    const updated = update(node);
    if (updated !== node) changed = true;
    return updated;
  });
  return changed ? next : nodes;
}

function countNodes(nodes: readonly CreativeNode[]): number {
  let total = 0;
  for (const node of nodes) {
    total += 1;
    if (node.type === 'group') total += node.children.length;
  }
  return total;
}

function assertCapacity(document: CreativeDocument, additional: number): void {
  if (countNodes(document.nodes) + additional > CREATIVE_LIMITS.maxNodes) {
    throw new Error(`A design cannot hold more than ${CREATIVE_LIMITS.maxNodes} elements.`);
  }
}

export function addNode(document: CreativeDocument, node: CreativeNode): CreativeDocument {
  assertCapacity(document, 1);
  return touch(document, [...document.nodes, node]);
}

export function addNodes(
  document: CreativeDocument,
  nodes: readonly CreativeNode[],
): CreativeDocument {
  assertCapacity(document, nodes.length);
  return touch(document, [...document.nodes, ...nodes]);
}

/**
 * Remove nodes.
 *
 * Locked nodes are protected: deleting a locked layer is refused unless the caller
 * unlocks it first. This is deliberate — a lock that can be bypassed by a stray
 * Delete key is not a lock.
 */
export function removeNodes(document: CreativeDocument, ids: readonly string[]): CreativeDocument {
  const removing = new Set(ids);
  const removable = document.nodes.filter((node) => removing.has(node.id) && !node.locked);
  if (removable.length === 0) return document;

  const removableIds = new Set(removable.map((node) => node.id));
  return touch(
    document,
    document.nodes.filter((node) => !removableIds.has(node.id)),
  );
}

export function updateNode(
  document: CreativeDocument,
  id: string,
  changes: Partial<Omit<CreativeNode, 'type' | 'id'>>,
): CreativeDocument {
  const nodes = replaceNode(
    document.nodes,
    id,
    (node) => ({ ...node, ...changes }) as CreativeNode,
  );
  return nodes === document.nodes ? document : touch(document, nodes);
}

export function updateNodes(
  document: CreativeDocument,
  updates: Readonly<Record<string, Partial<Omit<CreativeNode, 'type' | 'id'>>>>,
): CreativeDocument {
  const nodes = document.nodes.map((node) => {
    const changes = updates[node.id];
    return changes ? ({ ...node, ...changes } as CreativeNode) : node;
  });
  return touch(document, nodes);
}

export function duplicateNodes(
  document: CreativeDocument,
  ids: readonly string[],
  offset = 24,
): { document: CreativeDocument; createdIds: readonly string[] } {
  const selected = new Set(ids);
  const copies: CreativeNode[] = [];

  for (const node of document.nodes) {
    if (!selected.has(node.id)) continue;
    copies.push({
      ...node,
      id: createNodeId(),
      name: `${node.name} copy`.slice(0, 80),
      x: node.x + offset,
      y: node.y + offset,
      locked: false,
      hidden: false,
      ...(node.type === 'group'
        ? { children: node.children.map((child) => ({ ...child, id: createNodeId() })) }
        : {}),
    } as CreativeNode);
  }

  if (copies.length === 0) return { document, createdIds: [] };

  const next = addNodes(document, copies);
  return { document: next, createdIds: copies.map((copy) => copy.id) };
}

export function reorderNode(
  document: CreativeDocument,
  id: string,
  direction: 'front' | 'back' | 'forward' | 'backward',
): CreativeDocument {
  const index = document.nodes.findIndex((node) => node.id === id);
  if (index < 0) return document;

  const nodes = [...document.nodes];
  const [node] = nodes.splice(index, 1);
  if (!node) return document;

  switch (direction) {
    case 'front':
      nodes.push(node);
      break;
    case 'back':
      nodes.unshift(node);
      break;
    case 'forward':
      nodes.splice(Math.min(index + 1, nodes.length), 0, node);
      break;
    case 'backward':
      nodes.splice(Math.max(index - 1, 0), 0, node);
      break;
  }

  return touch(document, nodes);
}

export function groupNodes(
  document: CreativeDocument,
  ids: readonly string[],
): { document: CreativeDocument; groupId: string | null } {
  const selected = new Set(ids);
  const members = document.nodes.filter((node) => selected.has(node.id));
  if (members.length < 2) return { document, groupId: null };

  const bounds = boundsOf(members);
  if (!bounds) return { document, groupId: null };

  const groupId = createNodeId();
  const group: CreativeNode = {
    id: groupId,
    type: 'group',
    name: 'Group',
    x: bounds.left,
    y: bounds.top,
    width: Math.max(bounds.width, 1),
    height: Math.max(bounds.height, 1),
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    children: members,
  };

  const remaining = document.nodes.filter((node) => !selected.has(node.id));
  return { document: touch(document, [...remaining, group]), groupId };
}

export function duplicateNodeTree(node: CreativeNode, offset = 24): CreativeNode {
  return {
    ...node,
    id: createNodeId(),
    name: `${node.name} copy`.slice(0, 80),
    x: node.x + offset,
    y: node.y + offset,
    locked: false,
    hidden: false,
    ...(node.type === 'group'
      ? { children: node.children.map((child) => duplicateNodeTree(child, offset)) }
      : {}),
  } as CreativeNode;
}

/* -------------------------------------------------------------------------- */
/* Constructors                                                                */
/* -------------------------------------------------------------------------- */

export interface TextNodeOptions {
  readonly id?: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly fontSize: number;
  readonly color: CreativeColor;
  readonly fontFamily?: FontFamilyId;
  readonly weight?: 400 | 500 | 600 | 700 | 800;
  readonly lineHeight?: number;
  readonly align?: 'left' | 'center' | 'right';
  readonly name?: string;
}

export function createTextNode(options: TextNodeOptions): CreativeTextNode {
  const lineHeight = options.lineHeight ?? 1.15;
  return {
    id: options.id ?? createNodeId(),
    type: 'text',
    name: options.name ?? options.text.slice(0, 40) ?? 'Text',
    x: options.x,
    y: options.y,
    width: options.width,
    height: Math.max(options.fontSize, Math.round(options.fontSize * lineHeight)),
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: options.text,
    fontFamily: options.fontFamily ?? 'sans',
    fontSize: options.fontSize,
    fontWeight: options.weight ?? 600,
    italic: false,
    underline: false,
    align: options.align ?? 'left',
    lineHeight,
    letterSpacing: 0,
    color: options.color,
    verticalAlign: 'top',
  };
}

export interface ShapeNodeOptions {
  readonly id?: string;
  readonly shape: CreativeShapeKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: CreativePaint;
  readonly cornerRadius?: number;
  readonly stroke?: CreativeShapeNode['stroke'];
  readonly name?: string;
}

export function createShapeNode(options: ShapeNodeOptions): CreativeShapeNode {
  return {
    id: options.id ?? createNodeId(),
    type: 'shape',
    name: options.name ?? options.shape,
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    shape: options.shape,
    fill: options.fill,
    stroke: options.stroke ?? null,
    cornerRadius: options.cornerRadius ?? 0,
  };
}

export interface ImageNodeOptions {
  readonly id?: string;
  readonly assetId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly name?: string;
}

export function createImageNode(options: ImageNodeOptions): CreativeImageNode {
  return {
    id: options.id ?? createNodeId(),
    type: 'image',
    name: options.name ?? 'Image',
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: options.assetId,
    fit: 'cover',
    crop: { x: 0, y: 0, width: 1, height: 1 },
  };
}

/* -------------------------------------------------------------------------- */
/* Gesture helpers                                                             */
/* -------------------------------------------------------------------------- */

export function moveNodes(
  document: CreativeDocument,
  ids: readonly string[],
  delta: Point,
): CreativeDocument {
  if (delta.x === 0 && delta.y === 0) return document;
  const selected = new Set(ids);
  let moved = false;

  const nodes = document.nodes.map((node) => {
    if (!selected.has(node.id) || node.locked) return node;
    moved = true;
    return { ...node, x: node.x + delta.x, y: node.y + delta.y };
  });

  return moved ? touch(document, nodes) : document;
}

export function resizeSelectedNode(
  document: CreativeDocument,
  id: string,
  handle: ResizeHandle,
  pointer: Point,
  options: { readonly keepAspect?: boolean } = {},
): CreativeDocument {
  const node = document.nodes.find((candidate) => candidate.id === id);
  if (!node) return document;

  const result = resizeNode(node, handle, pointer, options);
  return updateNode(document, id, result);
}

export function alignSelection(
  document: CreativeDocument,
  ids: readonly string[],
  mode: AlignMode,
): CreativeDocument {
  const selected = document.nodes.filter((node) => ids.includes(node.id));
  if (selected.length === 0) return document;

  // Node coordinates are document pixels, so the canvas must be converted the
  // same way for print (mm) and digital (px) documents.
  const pixels = toDocPixels(document.canvas);
  const reference =
    selected.length === 1
      ? {
          left: 0,
          top: 0,
          right: pixels.width,
          bottom: pixels.height,
          width: pixels.width,
          height: pixels.height,
        }
      : boundsOf(selected);

  if (!reference) return document;

  const offsets = alignNodes(selected, mode, reference);
  return updateNodes(document, offsets);
}

export function nudgeSelection(
  document: CreativeDocument,
  ids: readonly string[],
  dx: number,
  dy: number,
): CreativeDocument {
  return moveNodes(document, ids, { x: dx, y: dy });
}

/** Serialise the document for a project file. */
export function cloneDocument(document: CreativeDocument): CreativeDocument {
  return JSON.parse(JSON.stringify(document)) as CreativeDocument;
}
