/**
 * Canvas renderer.
 *
 * Draws a validated `CreativeDocument` into a 2D context. It is a pure function
 * of its arguments: no state, no timers, no network. That makes it usable for the
 * live editor, for thumbnails and for export without three separate code paths.
 *
 * The caller owns the transform. The editor scales so one document pixel maps to
 * one device pixel at 100% zoom; export scales up for print resolution.
 */

import {
  getFontFamily,
  type CreativeColor,
  type CreativeDocument,
  type CreativeNode,
  type CreativePaint,
  type CreativeShapeNode,
  type CreativeTextNode,
} from '@quickbiz/shared';
import { toDocPixels } from '@quickbiz/shared';
import { boundsOf, rotateHandlePoint } from '../engine/geometry';

export interface RenderAsset {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

export interface RenderOptions {
  /** Assets by id. A missing asset is drawn as a placeholder, never as an error. */
  readonly assets?: ReadonlyMap<string, RenderAsset>;
  /** Selection outline and handles. Off for export and thumbnails. */
  readonly selection?: readonly string[];
  readonly showSelection?: boolean;
  readonly selectionColor?: string;
  /** Omit the page background, used for transparent PNG export. */
  readonly skipBackground?: boolean;
}

const DEFAULT_SELECTION_COLOR = '#6741E8';
const HANDLE_SIZE = 9;

function parseColor(color: CreativeColor): string {
  return color;
}

function paintFor(
  ctx: CanvasRenderingContext2D,
  paint: CreativePaint,
  x: number,
  y: number,
  width: number,
  height: number,
): string | CanvasGradient {
  if (paint.type === 'solid') return parseColor(paint.color);

  const angle = (paint.angle * Math.PI) / 180;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const dx = Math.cos(angle) * halfWidth;
  const dy = Math.sin(angle) * halfHeight;
  const gradient = ctx.createLinearGradient(
    x + halfWidth - dx,
    y + halfHeight - dy,
    x + halfWidth + dx,
    y + halfHeight + dy,
  );
  gradient.addColorStop(0, paint.from);
  gradient.addColorStop(1, paint.to);
  return gradient;
}

export interface TextLineLayout {
  readonly text: string;
  readonly width: number;
}

export interface TextLayout {
  readonly lines: readonly TextLineLayout[];
  readonly lineHeight: number;
  readonly totalHeight: number;
}

type ContextWithLetterSpacing = CanvasRenderingContext2D & { letterSpacing?: string };

function fontShorthand(node: CreativeTextNode): string {
  const family = getFontFamily(node.fontFamily).stack;
  return `${node.italic ? 'italic ' : ''}${node.fontWeight} ${node.fontSize}px ${family}`;
}

function wrapLines(ctx: CanvasRenderingContext2D, node: CreativeTextNode): string[] {
  const lines: string[] = [];

  for (const paragraph of node.text.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      if (word.length === 0) continue;
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (ctx.measureText(candidate).width <= node.width) {
        current = candidate;
        continue;
      }

      if (current.length > 0) {
        lines.push(current);
      }

      if (ctx.measureText(word).width <= node.width) {
        current = word;
        continue;
      }

      let chunk = '';
      for (const character of word) {
        if (chunk.length > 0 && ctx.measureText(chunk + character).width > node.width) {
          lines.push(chunk);
          chunk = character;
          continue;
        }
        chunk += character;
      }
      current = chunk;
    }

    if (current.length > 0) lines.push(current);
  }

  return lines.length === 0 ? [''] : lines;
}

export function layoutText(ctx: CanvasRenderingContext2D, node: CreativeTextNode): TextLayout {
  const previousFont = ctx.font;
  const previousSpacing = (ctx as ContextWithLetterSpacing).letterSpacing;

  ctx.font = fontShorthand(node);
  if ('letterSpacing' in ctx) {
    (ctx as ContextWithLetterSpacing).letterSpacing = `${node.letterSpacing}px`;
  }

  const text = ctx.measureText(node.text).width > 0 ? wrapLines(ctx, node) : [''];
  const lineHeight = node.fontSize * node.lineHeight;
  const measured = text.map((line) => ({ text: line, width: ctx.measureText(line).width }));

  ctx.font = previousFont;
  if (previousSpacing === undefined) {
    (ctx as ContextWithLetterSpacing).letterSpacing = '0px';
  } else {
    (ctx as ContextWithLetterSpacing).letterSpacing = previousSpacing;
  }

  return { lines: measured, lineHeight, totalHeight: measured.length * lineHeight };
}

function drawText(ctx: CanvasRenderingContext2D, node: CreativeTextNode): void {
  if (node.text.length === 0) return;

  const layout = layoutText(ctx, node);
  const insetTop =
    node.verticalAlign === 'middle'
      ? (node.height - layout.totalHeight) / 2
      : node.verticalAlign === 'bottom'
        ? node.height - layout.totalHeight
        : 0;

  ctx.font = fontShorthand(node);
  if ('letterSpacing' in ctx) {
    (ctx as ContextWithLetterSpacing).letterSpacing = `${node.letterSpacing}px`;
  }
  ctx.fillStyle = parseColor(node.color);
  ctx.textBaseline = 'top';

  layout.lines.forEach((line, index) => {
    const y =
      node.y + insetTop + index * layout.lineHeight + (layout.lineHeight - node.fontSize) / 2;
    let x = node.x;

    if (node.align === 'center') x = node.x + (node.width - line.width) / 2;
    else if (node.align === 'right') x = node.x + node.width - line.width;

    ctx.fillText(line.text, x, y);

    if (node.underline && line.text.length > 0) {
      ctx.fillRect(x, y + node.fontSize * 0.95, line.width, Math.max(1, node.fontSize * 0.06));
    }
  });
}

function shapePath(ctx: CanvasRenderingContext2D, node: CreativeShapeNode): void {
  const { x, y, width, height } = node;

  switch (node.shape) {
    case 'rect':
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      return;
    case 'roundRect': {
      const radius = Math.min(node.cornerRadius, Math.min(width, height) / 2);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, width, height, radius);
      } else {
        ctx.rect(x, y, width, height);
      }
      return;
    }
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      return;
    case 'line':
      ctx.beginPath();
      ctx.moveTo(x, y + height / 2);
      ctx.lineTo(x + width, y + height / 2);
      return;
    case 'arrow':
      ctx.beginPath();
      ctx.moveTo(x, y + height / 2);
      ctx.lineTo(x + width, y + height / 2);
      ctx.lineTo(x + width - height * 0.4, y + height / 2 - height * 0.35);
      ctx.moveTo(x + width, y + height / 2);
      ctx.lineTo(x + width - height * 0.4, y + height / 2 + height * 0.35);
      return;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
      return;
    case 'star': {
      const spikes = 5;
      const outerX = width / 2;
      const outerY = height / 2;
      const centerX = x + outerX;
      const centerY = y + outerY;
      ctx.beginPath();
      for (let index = 0; index < spikes * 2; index += 1) {
        const radius = index % 2 === 0 ? 1 : 0.42;
        const angle = (Math.PI / spikes) * index - Math.PI / 2;
        const px = centerX + Math.cos(angle) * outerX * radius;
        const py = centerY + Math.sin(angle) * outerY * radius;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      return;
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, node: CreativeShapeNode): void {
  shapePath(ctx, node);

  if (node.shape !== 'line' && node.shape !== 'arrow') {
    ctx.fillStyle = paintFor(ctx, node.fill, node.x, node.y, node.width, node.height);
    ctx.fill();
  }

  if (node.stroke && node.stroke.width > 0) {
    ctx.strokeStyle = parseColor(node.stroke.color);
    ctx.lineWidth = node.stroke.width;
    ctx.setLineDash(
      node.stroke.style === 'dashed'
        ? [node.stroke.width * 3, node.stroke.width * 2]
        : node.stroke.style === 'dotted'
          ? [node.stroke.width, node.stroke.width * 2]
          : [],
    );
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  node: Extract<CreativeNode, { type: 'image' }>,
  options: RenderOptions,
): void {
  const asset = options.assets?.get(node.assetId);

  ctx.save();
  ctx.beginPath();
  ctx.rect(node.x, node.y, node.width, node.height);
  ctx.clip();

  if (!asset) {
    ctx.fillStyle = '#EEF1F7';
    ctx.fillRect(node.x, node.y, node.width, node.height);
    ctx.strokeStyle = '#CBD2E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(node.x + 1, node.y + 1, node.width - 2, node.height - 2);
    ctx.restore();
    return;
  }

  const crop = node.crop;
  const sourceWidth = Math.max(1, asset.width * crop.width);
  const sourceHeight = Math.max(1, asset.height * crop.height);
  const sourceX = asset.width * crop.x;
  const sourceY = asset.height * crop.y;

  const scale =
    node.fit === 'cover'
      ? Math.max(node.width / sourceWidth, node.height / sourceHeight)
      : Math.min(node.width / sourceWidth, node.height / sourceHeight);

  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = node.x + (node.width - drawWidth) / 2;
  const drawY = node.y + (node.height - drawHeight) / 2;

  ctx.drawImage(
    asset.image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
}

function drawNode(ctx: CanvasRenderingContext2D, node: CreativeNode, options: RenderOptions): void {
  if (node.hidden) return;

  ctx.save();
  ctx.globalAlpha = node.opacity;
  if (node.rotation !== 0) {
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((node.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  if (node.type === 'group') {
    for (const child of node.children) drawNode(ctx, child, options);
  } else if (node.type === 'text') {
    drawText(ctx, node);
  } else if (node.type === 'shape') {
    drawShape(ctx, node);
  } else {
    drawImage(ctx, node, options);
  }

  ctx.restore();
}

function drawSelection(ctx: CanvasRenderingContext2D, node: CreativeNode, color: string): void {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((node.rotation * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(node.x, node.y, node.width, node.height);

  const positions: ReadonlyArray<readonly [number, number]> = [
    [node.x, node.y],
    [node.x + node.width / 2, node.y],
    [node.x + node.width, node.y],
    [node.x + node.width, node.y + node.height / 2],
    [node.x + node.width, node.y + node.height],
    [node.x + node.width / 2, node.y + node.height],
    [node.x, node.y + node.height],
    [node.x, node.y + node.height / 2],
  ];

  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  for (const [x, y] of positions) {
    ctx.beginPath();
    ctx.rect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  const rotateHandle = rotateHandlePoint(node);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(rotateHandle.x, rotateHandle.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rotateHandle.x, rotateHandle.y, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Render a document. The context must already be scaled to document pixels. */
export function renderDocument(
  ctx: CanvasRenderingContext2D,
  document: CreativeDocument,
  options: RenderOptions = {},
): void {
  const { width, height } = toDocPixels(document.canvas);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  ctx.save();

  if (options.skipBackground !== true) {
    ctx.fillStyle = paintFor(ctx, document.canvas.background, 0, 0, width, height);
    ctx.fillRect(0, 0, width, height);
  }

  for (const node of document.nodes) drawNode(ctx, node, options);

  if (options.showSelection && options.selection && options.selection.length > 0) {
    const color = options.selectionColor ?? DEFAULT_SELECTION_COLOR;
    for (const node of document.nodes) {
      if (options.selection.includes(node.id)) drawSelection(ctx, node, color);
    }
  }

  ctx.restore();
}

/** Bounding box of the current selection, in document coordinates. */
export function selectionBounds(
  document: CreativeDocument,
  ids: readonly string[],
): ReturnType<typeof boundsOf> {
  if (ids.length === 0) return null;
  return boundsOf(document.nodes.filter((node) => ids.includes(node.id)));
}
