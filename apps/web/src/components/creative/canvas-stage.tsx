import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toDocPixels, type CreativeDocument, type CreativeNode } from '@quickbiz/shared';
import {
  angleForRotation,
  boundsIntersect,
  clamp,
  hitTest,
  nodeCenter,
  rotatePoint,
  normaliseRotation,
  rectFromPoints,
  resizeNode,
  rotateHandlePoint,
  type Point,
  type ResizeHandle,
} from '../../lib/creative/engine/geometry';
import { renderDocument, type RenderAsset } from '../../lib/creative/render/render-document';

export type StudioTool = 'select' | 'text' | 'shape' | 'image';

interface InteractionBase {
  readonly start: Point;
  readonly initial: CreativeDocument;
  readonly historyKey: string;
}

type Interaction =
  | (InteractionBase & { readonly mode: 'move' })
  | (InteractionBase & {
      readonly mode: 'resize';
      readonly handle: ResizeHandle;
      readonly id: string;
    })
  | (InteractionBase & {
      readonly mode: 'rotate';
      readonly id: string;
      readonly startAngle: number;
    })
  | (InteractionBase & { readonly mode: 'marquee'; readonly additive: boolean });

const HANDLE_TOLERANCE_PX = 12;

export interface CanvasStageProps {
  readonly document: CreativeDocument;
  readonly selection: readonly string[];
  readonly assets: ReadonlyMap<string, RenderAsset>;
  readonly tool: StudioTool;
  /** 1 = fit to the available space. */
  readonly zoomFactor: number;
  readonly onScaleChange?: (scale: number) => void;
  readonly onSelect: (ids: readonly string[], additive?: boolean) => void;
  readonly onCommit: (next: CreativeDocument, historyKey?: string) => void;
  readonly onBeginGesture: (key: string) => void;
  readonly onEndGesture: () => void;
  readonly onCanvasTap?: (point: Point) => void;
  readonly onEditText?: (id: string) => void;
}

function toDocPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  scale: number,
): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}

/**
 * The interactive artboard.
 *
 * The stage owns transient state during a gesture (a local draft document) and
 * hands one final document back on pointer-up. React therefore never re-renders
 * the surrounding panels sixty times a second while a shape is dragged.
 */
export function CanvasStage(props: CanvasStageProps) {
  const {
    document,
    selection,
    assets,
    tool,
    zoomFactor,
    onScaleChange,
    onSelect,
    onCommit,
    onBeginGesture,
    onEndGesture,
    onCanvasTap,
    onEditText,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);

  const [draft, setDraft] = useState<CreativeDocument | null>(null);
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const pixels = toDocPixels(document.canvas);
  const fitScale =
    viewport.width > 0 && viewport.height > 0
      ? Math.min((viewport.width - 48) / pixels.width, (viewport.height - 48) / pixels.height)
      : 0.2;
  const scale = clamp(fitScale * zoomFactor, 0.02, 8);

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const active = draft ?? document;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Math.max(1, Math.round(pixels.width * scale));
    const cssHeight = Math.max(1, Math.round(pixels.height * scale));

    if (
      canvas.width !== Math.round(cssWidth * ratio) ||
      canvas.height !== Math.round(cssHeight * ratio)
    ) {
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0);
    renderDocument(context, active, {
      assets,
      selection,
      showSelection: interactionRef.current?.mode !== 'marquee',
    });

    if (marquee) {
      context.save();
      context.strokeStyle = '#6741E8';
      context.fillStyle = 'rgba(103, 65, 232, 0.12)';
      context.lineWidth = 1 / scale;
      context.fillRect(marquee.left, marquee.top, marquee.width, marquee.height);
      context.strokeRect(marquee.left, marquee.top, marquee.width, marquee.height);
      context.restore();
    }
  }, [active, assets, marquee, pixels.height, pixels.width, scale, selection]);

  const finishInteraction = useCallback(() => {
    const interaction = interactionRef.current;
    if (!interaction) return;

    interactionRef.current = null;
    setMarquee(null);
    setDraft((current) => {
      if (current && current !== interaction.initial) {
        onCommit(current, interaction.historyKey);
      }
      return null;
    });
    onEndGesture();
  }, [onCommit, onEndGesture]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = toDocPoint(canvas, event.clientX, event.clientY, scale);
    canvas.setPointerCapture(event.pointerId);

    if (tool !== 'select') {
      onCanvasTap?.(point);
      return;
    }

    // Resize and rotate handles of a single selection come first.
    if (selection.length === 1) {
      const node = document.nodes.find((candidate) => candidate.id === selection[0]);
      if (node && !node.locked) {
        const rotatePoint = rotateHandlePoint(node, 28 / scale);
        const rotateDistance = Math.hypot(rotatePoint.x - point.x, rotatePoint.y - point.y);
        if (rotateDistance * scale <= HANDLE_TOLERANCE_PX) {
          onBeginGesture(`rotate:${node.id}`);
          interactionRef.current = {
            mode: 'rotate',
            start: point,
            initial: document,
            historyKey: `rotate:${node.id}`,
            id: node.id,
            startAngle: angleForRotation(node, point),
          };
          return;
        }

        const handle = findHandle(node, point, scale);
        if (handle) {
          onBeginGesture(`resize:${node.id}`);
          interactionRef.current = {
            mode: 'resize',
            start: point,
            initial: document,
            historyKey: `resize:${node.id}`,
            id: node.id,
            handle,
          };
          return;
        }
      }
    }

    const hit = hitTest(document.nodes, point);
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;

    if (hit) {
      if (additive) {
        onSelect([hit.id], true);
      } else if (!selection.includes(hit.id)) {
        onSelect([hit.id]);
      }

      if (hit.locked) return;

      onBeginGesture(`move:${hit.id}`);
      interactionRef.current = {
        mode: 'move',
        start: point,
        initial: document,
        historyKey: `move:${hit.id}`,
      };
      return;
    }

    if (!additive) onSelect([]);
    onBeginGesture('marquee');
    interactionRef.current = {
      mode: 'marquee',
      start: point,
      initial: document,
      historyKey: 'marquee',
      additive,
    };
    setMarquee({ left: point.x, top: point.y, width: 0, height: 0 });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const interaction = interactionRef.current;
    const canvas = canvasRef.current;
    if (!interaction || !canvas) return;

    const point = toDocPoint(canvas, event.clientX, event.clientY, scale);
    const dx = point.x - interaction.start.x;
    const dy = point.y - interaction.start.y;

    switch (interaction.mode) {
      case 'move': {
        const nodes = interaction.initial.nodes.map((node) =>
          selection.includes(node.id) && !node.locked
            ? { ...node, x: node.x + dx, y: node.y + dy }
            : node,
        );
        setDraft({ ...interaction.initial, nodes });
        return;
      }
      case 'resize': {
        const node = interaction.initial.nodes.find((candidate) => candidate.id === interaction.id);
        if (!node) return;
        const result = resizeNode(node, interaction.handle, point, { keepAspect: event.shiftKey });
        const nodes = interaction.initial.nodes.map((candidate) =>
          candidate.id === interaction.id ? { ...candidate, ...result } : candidate,
        );
        setDraft({ ...interaction.initial, nodes });
        return;
      }
      case 'rotate': {
        const node = interaction.initial.nodes.find((candidate) => candidate.id === interaction.id);
        if (!node) return;
        const angle = angleForRotation(node, point);
        const rotation = normaliseRotation(node.rotation + (angle - interaction.startAngle));
        const nodes = interaction.initial.nodes.map((candidate) =>
          candidate.id === interaction.id ? { ...candidate, rotation } : candidate,
        );
        setDraft({ ...interaction.initial, nodes });
        return;
      }
      case 'marquee': {
        const rect = rectFromPoints(interaction.start, point);
        setMarquee({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });

        const matches = interaction.initial.nodes
          .filter((node) => {
            const nodeBounds = {
              left: node.x,
              top: node.y,
              right: node.x + node.width,
              bottom: node.y + node.height,
              width: node.width,
              height: node.height,
            };
            return boundsIntersect(rect, nodeBounds);
          })
          .map((node) => node.id);

        onSelect(matches, interaction.additive);
        return;
      }
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    finishInteraction();
  };

  return (
    <div ref={containerRef} className="flex size-full items-center justify-center overflow-auto">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${document.title} artboard`}
        className={`touch-none rounded-sm shadow-elev-3 ring-1 ring-border ${
          tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={(event) => {
          const canvas = canvasRef.current;
          if (!canvas || selection.length !== 1) return;
          const node = document.nodes.find((candidate) => candidate.id === selection[0]);
          if (node?.type === 'text') onEditText?.(node.id);
          event.preventDefault();
        }}
      />
    </div>
  );
}

function findHandle(node: CreativeNode, point: Point, scale: number): ResizeHandle | null {
  const corners: ReadonlyArray<readonly [ResizeHandle, Point]> = [
    ['nw', { x: node.x, y: node.y }],
    ['n', { x: node.x + node.width / 2, y: node.y }],
    ['ne', { x: node.x + node.width, y: node.y }],
    ['e', { x: node.x + node.width, y: node.y + node.height / 2 }],
    ['se', { x: node.x + node.width, y: node.y + node.height }],
    ['s', { x: node.x + node.width / 2, y: node.y + node.height }],
    ['sw', { x: node.x, y: node.y + node.height }],
    ['w', { x: node.x, y: node.y + node.height / 2 }],
  ];
  const centre = nodeCenter(node);
  const positions = corners.map(
    ([handle, corner]) => [handle, rotatePoint(corner, centre, node.rotation)] as const,
  );

  let best: ResizeHandle | null = null;
  let bestDistance = HANDLE_TOLERANCE_PX / scale;

  for (const [handle, position] of positions) {
    const distance = Math.hypot(position.x - point.x, position.y - point.y);
    if (distance <= bestDistance) {
      best = handle;
      bestDistance = distance;
    }
  }

  return best;
}
