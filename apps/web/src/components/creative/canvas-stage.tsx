import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toDocPixels, type CreativeDocument, type CreativeNode } from '@quickbiz/shared';
import {
  angleForRotation,
  clamp,
  hitTest,
  nodeCenter,
  normaliseRotation,
  rectFromPoints,
  resizeNode,
  rotateHandlePoint,
  rotatePoint,
  type Point,
  type ResizeHandle,
} from '../../lib/creative/engine/geometry';
import { renderDocument, type RenderAsset } from '../../lib/creative/render/render-document';
import {
  clampPan,
  clampScale,
  clampZoomFactor,
  marqueeSelection,
  panForAnchoredZoom,
  MAX_ZOOM_FACTOR,
  MIN_ZOOM_FACTOR,
} from '../../lib/creative/engine/view';

export type StudioTool = 'select' | 'text' | 'shape' | 'image';

type Interaction =
  | {
      readonly mode: 'move';
      readonly start: Point;
      readonly initial: CreativeDocument;
      readonly historyKey: string;
    }
  | {
      readonly mode: 'resize';
      readonly start: Point;
      readonly initial: CreativeDocument;
      readonly historyKey: string;
      readonly id: string;
      readonly handle: ResizeHandle;
    }
  | {
      readonly mode: 'rotate';
      readonly start: Point;
      readonly initial: CreativeDocument;
      readonly historyKey: string;
      readonly id: string;
      readonly startAngle: number;
    }
  | {
      readonly mode: 'marquee';
      readonly start: Point;
      readonly initial: CreativeDocument;
      readonly historyKey: string;
      readonly additive: boolean;
    };

interface PinchState {
  readonly distance: number;
  readonly centre: Point;
  readonly zoomFactor: number;
  readonly scale: number;
  /** Document point under the pinch centre when the gesture began. */
  readonly anchor: Point;
  readonly pan: Point;
}

const HANDLE_TOLERANCE_PX = 12;

export interface CanvasStageProps {
  readonly document: CreativeDocument;
  readonly selection: readonly string[];
  readonly assets: ReadonlyMap<string, RenderAsset>;
  readonly tool: StudioTool;
  /** 1 = fit to the available space. */
  readonly zoomFactor: number;
  readonly onZoomFactorChange: (factor: number) => void;
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

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The interactive artboard.
 *
 * Interaction model:
 *
 * - one pointer on an object selects, moves, resizes or rotates it;
 * - one pointer on empty canvas starts a marquee;
 * - two pointers pan and pinch-zoom the view, and cancel any object gesture;
 * - middle-button or space-drag pans with a mouse;
 * - the wheel zooms with Ctrl/⌘ and pans otherwise.
 *
 * Panning is applied by mutating the canvas transform directly, so dragging the
 * view does not re-render the document sixty times a second.
 */
export function CanvasStage(props: CanvasStageProps) {
  const {
    document,
    selection,
    assets,
    tool,
    zoomFactor,
    onZoomFactorChange,
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
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<PinchState | null>(null);
  const spaceRef = useRef(false);

  const [draft, setDraftState] = useState<CreativeDocument | null>(null);
  const draftRef = useRef<CreativeDocument | null>(null);
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const panRef = useRef<Point>({ x: 0, y: 0 });

  const setDraft = useCallback((next: CreativeDocument | null) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);

  const applyPan = useCallback((next: Point) => {
    panRef.current = next;
    setPan(next);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.transform = `translate(${next.x}px, ${next.y}px)`;
  }, []);

  const pixels = toDocPixels(document.canvas);
  const fitScale =
    viewport.width > 0 && viewport.height > 0
      ? Math.min((viewport.width - 32) / pixels.width, (viewport.height - 32) / pixels.height)
      : 0.2;
  const scale = clampScale(fitScale * zoomFactor);

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Keep the pan valid when the viewport shrinks or the zoom changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = panRef.current;
    const next = clampPan(
      current,
      { width: canvas.offsetWidth, height: canvas.offsetHeight },
      viewport,
    );
    if (next.x !== current.x || next.y !== current.y) applyPan(next);
  }, [applyPan, scale, viewport, zoomFactor]);

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
      showSelection: interactionRef.current?.mode !== 'marquee' && pinchRef.current === null,
      selectionHandleOffset: 28 / scale,
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
  }, [active, assets, marquee, pixels.height, pixels.width, scale, selection, zoomFactor]);

  const cancelInteraction = useCallback(() => {
    interactionRef.current = null;
    setDraft(null);
    setMarquee(null);
  }, [setDraft]);

  const finishInteraction = useCallback(() => {
    const interaction = interactionRef.current;
    interactionRef.current = null;
    setMarquee(null);

    const finished = draftRef.current;
    draftRef.current = null;
    setDraftState(null);

    if (interaction && finished && finished !== interaction.initial) {
      onCommit(finished, interaction.historyKey);
    }
    onEndGesture();
  }, [onCommit, onEndGesture]);

  const startPan = (clientPoint: Point) => {
    pinchRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.dataset.panning = 'true';
    panStartRef.current = { pointer: clientPoint, pan: panRef.current };
  };

  const panStartRef = useRef<{ pointer: Point; pan: Point } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);

    if (pointersRef.current.size === 2) {
      // A second pointer turns the gesture into a view navigation, never an edit.
      cancelInteraction();
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const rect = canvas.getBoundingClientRect();
      pinchRef.current = {
        distance: Math.max(1, distanceBetween(a, b)),
        centre,
        zoomFactor,
        scale,
        anchor: { x: (centre.x - rect.left) / scale, y: (centre.y - rect.top) / scale },
        pan: panRef.current,
      };
      return;
    }

    if (pointersRef.current.size > 2) return;

    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      event.preventDefault();
      startPan({ x: event.clientX, y: event.clientY });
      return;
    }

    if (event.button !== 0 && event.pointerType === 'mouse') return;

    const point = toDocPoint(canvas, event.clientX, event.clientY, scale);

    if (tool !== 'select') {
      onCanvasTap?.(point);
      return;
    }

    if (selection.length === 1) {
      const node = document.nodes.find((candidate) => candidate.id === selection[0]);
      if (node && !node.locked) {
        const rotateTarget = rotateHandlePoint(node, 28 / scale);
        const rotateDistance = distanceBetween(rotateTarget, point) * scale;
        if (rotateDistance <= HANDLE_TOLERANCE_PX) {
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
      if (additive) onSelect([hit.id], true);
      else if (!selection.includes(hit.id)) onSelect([hit.id]);

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;

      const distance = Math.max(1, distanceBetween(a, b));
      const ratio = distance / pinch.distance;
      const nextFactor = clamp(pinch.zoomFactor * ratio, MIN_ZOOM_FACTOR, MAX_ZOOM_FACTOR);
      onZoomFactorChange(nextFactor);

      const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nextScale = clampScale(fitScale * nextFactor);

      // Keep the document point under the pinch centre fixed while zooming.
      applyPan(
        panForAnchoredZoom({
          pan: pinch.pan,
          anchor: pinch.anchor,
          fromScale: pinch.scale,
          toScale: nextScale,
          centreDelta: { x: centre.x - pinch.centre.x, y: centre.y - pinch.centre.y },
        }),
      );
      return;
    }

    const panStart = panStartRef.current;
    if (panStart) {
      applyPan({
        x: panStart.pan.x + (event.clientX - panStart.pointer.x),
        y: panStart.pan.y + (event.clientY - panStart.pointer.y),
      });
      return;
    }

    const interaction = interactionRef.current;
    if (!interaction) return;

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

        onSelect(
          marqueeSelection(interaction.initial.nodes, interaction.start, point),
          interaction.additive,
        );
        return;
      }
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2 && pinchRef.current) {
      pinchRef.current = null;
    }

    if (panStartRef.current && pointersRef.current.size === 0) {
      panStartRef.current = null;
      if (canvas) delete canvas.dataset.panning;
      return;
    }

    if (pointersRef.current.size === 0) finishInteraction();
  };

  // Space-drag panning and wheel navigation are view-only, so they never touch
  // the document or the history.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTextTarget(event.target)) {
        spaceRef.current = true;
        const canvas = canvasRef.current;
        if (canvas) canvas.dataset.panReady = 'true';
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      spaceRef.current = false;
      const canvas = canvasRef.current;
      if (canvas) delete canvas.dataset.panReady;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Wheel handling is attached natively with { passive: false } so the page
  // does not scroll or browser-zoom while the pointer is over the artboard.
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();

      if (event.ctrlKey || event.metaKey) {
        const next = clampZoomFactor(zoomFactor * (event.deltaY > 0 ? 0.9 : 1.1));
        if (next !== zoomFactor) onZoomFactorChange(next);
        return;
      }

      applyPan({ x: panRef.current.x - event.deltaX, y: panRef.current.y - event.deltaY });
    },
    [applyPan, onZoomFactorChange, zoomFactor],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const listener = (event: WheelEvent) => handleWheel(event);
    canvas.addEventListener('wheel', listener, { passive: false });
    return () => canvas.removeEventListener('wheel', listener);
  }, [handleWheel]);

  return (
    <div ref={containerRef} className="relative size-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${document.title} artboard`}
          className={`touch-none rounded-sm shadow-elev-3 ring-1 ring-border ${
            tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
          }`}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onContextMenu={(event) => event.preventDefault()}
          onDoubleClick={(event) => {
            if (selection.length !== 1) return;
            const node = document.nodes.find((candidate) => candidate.id === selection[0]);
            if (node?.type === 'text') onEditText?.(node.id);
            event.preventDefault();
          }}
        />
      </div>
    </div>
  );
}

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
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
