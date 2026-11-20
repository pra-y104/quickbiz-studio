/**
 * Editor state.
 *
 * Owns the document, the selection, undo/redo and autosave. The React tree reads
 * from here; the canvas writes through commands. Keeping this separate from the
 * canvas means the panels, the layers list and the renderer can never disagree
 * about what the document contains.
 *
 * Live drags are handled by the canvas itself and committed once on pointer-up,
 * so a gesture produces exactly one history entry and one autosave.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CreativeAssetRef,
  CreativeColor,
  CreativeDocument,
  CreativeImageNode,
  CreativeNode,
  CreativeShapeKind,
  CreativeShapeNode,
  CreativeTextNode,
  FontFamilyId,
} from '@quickbiz/shared';
import type { StudioSaveState } from '../../../components/creative/studio-shell';
import type { CreativeProjectRecord, CreativeProjectStore } from '../storage/project-store';
import { DocumentHistory } from '../engine/history';
import type { AlignMode } from '../engine/geometry';
import {
  addNode,
  alignSelection,
  createImageNode,
  createShapeNode,
  createTextNode,
  duplicateNodes,
  moveNodes,
  removeNodes,
  reorderNode,
  updateNode,
} from '../engine/commands';

export type NodePatch = Partial<
  Pick<
    CreativeTextNode,
    | 'text'
    | 'fontSize'
    | 'fontFamily'
    | 'fontWeight'
    | 'italic'
    | 'underline'
    | 'align'
    | 'lineHeight'
    | 'letterSpacing'
    | 'color'
    | 'verticalAlign'
  >
> &
  Partial<Pick<CreativeShapeNode, 'fill' | 'stroke' | 'cornerRadius' | 'shape'>> &
  Partial<Pick<CreativeImageNode, 'fit' | 'crop'>> &
  Partial<Pick<CreativeNode, 'opacity' | 'rotation' | 'locked' | 'hidden' | 'name'>>;

export interface UseStudioEditorOptions {
  readonly projectId: string;
  readonly initial: CreativeDocument;
  readonly store: CreativeProjectStore;
  readonly autosaveDelayMs?: number;
}

export interface StudioEditor {
  readonly document: CreativeDocument;
  readonly selection: readonly string[];
  readonly selectedNodes: readonly CreativeNode[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly saveState: StudioSaveState;
  readonly revision: number;

  select(ids: readonly string[], additive?: boolean): void;
  commit(next: CreativeDocument, options?: { readonly historyKey?: string }): void;
  beginGesture(key: string): void;
  endGesture(): void;
  undo(): void;
  redo(): void;
  saveNow(): Promise<void>;

  addText(options?: {
    readonly text?: string;
    readonly fontSize?: number;
    readonly color?: CreativeColor;
  }): string;
  addShape(shape: CreativeShapeKind): string;
  addImage(asset: CreativeAssetRef): string;
  duplicateSelection(): void;
  deleteSelection(): void;
  toggleLocked(): void;
  toggleHidden(): void;
  reorder(id: string, direction: 'front' | 'back' | 'forward' | 'backward'): void;
  align(mode: AlignMode): void;
  nudge(dx: number, dy: number): void;
  updateSelected(patch: NodePatch): void;
  replaceDocument(next: CreativeDocument): void;
}

const AUTOSAVE_DELAY_MS = 700;
const TEXT_DEFAULT_COLOR: CreativeColor = '#0B1222';
const SHAPE_DEFAULT_COLOR: CreativeColor = '#6741E8';

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Copy only the patch keys a node of this type can legally hold. */
function applyPatch(node: CreativeNode, patch: NodePatch): CreativeNode {
  const next: Record<string, unknown> = { ...node };

  const shared = ['opacity', 'rotation', 'locked', 'hidden', 'name'] as const;
  for (const key of shared) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }

  if (node.type === 'text') {
    const textKeys = [
      'text',
      'fontSize',
      'fontFamily',
      'fontWeight',
      'italic',
      'underline',
      'align',
      'lineHeight',
      'letterSpacing',
      'color',
      'verticalAlign',
    ] as const;
    for (const key of textKeys) {
      if (patch[key] !== undefined) next[key] = patch[key];
    }
    if (typeof next.fontSize === 'number') {
      next.fontSize = clampNumber(next.fontSize, 4, 400);
    }
    if (typeof next.lineHeight === 'number') {
      next.lineHeight = clampNumber(next.lineHeight, 0.8, 2.5);
    }
    if (typeof next.letterSpacing === 'number') {
      next.letterSpacing = clampNumber(next.letterSpacing, -10, 40);
    }
  }

  if (node.type === 'shape') {
    if (patch.fill !== undefined) next.fill = patch.fill;
    if (patch.stroke !== undefined) next.stroke = patch.stroke;
    if (patch.cornerRadius !== undefined) {
      next.cornerRadius = clampNumber(patch.cornerRadius, 0, 1_000);
    }
    if (patch.shape !== undefined) next.shape = patch.shape;
  }

  if (node.type === 'image') {
    if (patch.fit !== undefined) next.fit = patch.fit;
    if (patch.crop !== undefined) next.crop = patch.crop;
  }

  return next as unknown as CreativeNode;
}

function centreOfCanvas(document: CreativeDocument): { x: number; y: number } {
  return { x: document.canvas.width / 2, y: document.canvas.height / 2 };
}

export function useStudioEditor(options: UseStudioEditorOptions): StudioEditor {
  const { projectId, initial, store } = options;
  const autosaveDelay = options.autosaveDelayMs ?? AUTOSAVE_DELAY_MS;

  const historyRef = useRef<DocumentHistory>(new DocumentHistory(initial));
  const [document, setDocument] = useState<CreativeDocument>(initial);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [saveState, setSaveState] = useState<StudioSaveState>('saved');
  const [revision, setRevision] = useState(0);

  // The live document mirror. It is written in every mutator, never during render.
  const documentRef = useRef<CreativeDocument>(initial);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<CreativeDocument | null>(null);

  const persist = useCallback(
    async (snapshot: CreativeDocument) => {
      setSaveState('saving');
      try {
        const existing = await store.get(projectId);
        const record: CreativeProjectRecord = {
          id: projectId,
          title: snapshot.title,
          document: snapshot,
          ...(existing?.thumbnail === undefined ? {} : { thumbnail: existing.thumbnail }),
          createdAt: existing?.createdAt ?? snapshot.createdAt,
          updatedAt: new Date().toISOString(),
        };
        await store.put(record);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    },
    [projectId, store],
  );

  const scheduleSave = useCallback(
    (snapshot: CreativeDocument) => {
      pendingSave.current = snapshot;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        const pending = pendingSave.current;
        pendingSave.current = null;
        if (pending) void persist(pending);
      }, autosaveDelay);
    },
    [autosaveDelay, persist],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        const pending = pendingSave.current;
        pendingSave.current = null;
        if (pending) void persist(pending);
      }
    };
  }, [persist]);

  const commit = useCallback(
    (next: CreativeDocument, commitOptions: { readonly historyKey?: string } = {}) => {
      const current = historyRef.current;
      current.commit(next, { key: commitOptions.historyKey });
      const value = current.current;
      documentRef.current = value;
      setHistoryState({ canUndo: current.canUndo, canRedo: current.canRedo });
      setDocument(value);
      setRevision((count) => count + 1);
      setSelection((ids) => {
        const present = new Set(value.nodes.map((node) => node.id));
        const kept = ids.filter((id) => present.has(id));
        return kept.length === ids.length ? ids : kept;
      });
      setSaveState('saving');
      scheduleSave(value);
    },
    [scheduleSave],
  );

  const select = useCallback((ids: readonly string[], additive = false) => {
    setSelection((current) => {
      if (!additive) return ids;
      const merged = new Set(current);
      for (const id of ids) {
        if (merged.has(id)) merged.delete(id);
        else merged.add(id);
      }
      return [...merged];
    });
  }, []);

  const undo = useCallback(() => {
    const value = historyRef.current.undo();
    if (!value) return;
    documentRef.current = value;
    setHistoryState({ canUndo: historyRef.current.canUndo, canRedo: historyRef.current.canRedo });
    setDocument(value);
    setRevision((count) => count + 1);
    setSaveState('saving');
    scheduleSave(value);
  }, [scheduleSave]);

  const redo = useCallback(() => {
    const value = historyRef.current.redo();
    if (!value) return;
    documentRef.current = value;
    setHistoryState({ canUndo: historyRef.current.canUndo, canRedo: historyRef.current.canRedo });
    setDocument(value);
    setRevision((count) => count + 1);
    setSaveState('saving');
    scheduleSave(value);
  }, [scheduleSave]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSave.current ?? documentRef.current;
    pendingSave.current = null;
    await persist(pending);
  }, [persist]);

  const addText = useCallback(
    (
      textOptions: {
        readonly text?: string;
        readonly fontSize?: number;
        readonly color?: CreativeColor;
      } = {},
    ) => {
      const current = documentRef.current;
      const centre = centreOfCanvas(current);
      const fontSize = textOptions.fontSize ?? 64;
      const node = createTextNode({
        text: textOptions.text ?? 'Your text here',
        x: Math.round(centre.x - 200),
        y: Math.round(centre.y - fontSize / 2),
        width: 400,
        fontSize,
        color: textOptions.color ?? TEXT_DEFAULT_COLOR,
        weight: 700,
      });
      commit(addNode(current, node));
      setSelection([node.id]);
      return node.id;
    },
    [commit],
  );

  const addShape = useCallback(
    (shape: CreativeShapeKind) => {
      const current = documentRef.current;
      const centre = centreOfCanvas(current);
      const size = 240;
      const node = createShapeNode({
        shape,
        x: Math.round(centre.x - size / 2),
        y: Math.round(centre.y - size / 2),
        width: size,
        height: shape === 'line' || shape === 'arrow' ? 24 : size,
        fill: { type: 'solid', color: SHAPE_DEFAULT_COLOR },
        cornerRadius: shape === 'roundRect' ? 24 : 0,
      });
      commit(addNode(current, node));
      setSelection([node.id]);
      return node.id;
    },
    [commit],
  );

  const addImage = useCallback(
    (asset: CreativeAssetRef) => {
      const current = documentRef.current;
      const centre = centreOfCanvas(current);
      const maxSide = Math.min(current.canvas.width, current.canvas.height) * 0.5;
      const scale = Math.min(maxSide / asset.width, maxSide / asset.height, 1);
      const width = Math.max(24, Math.round(asset.width * scale));
      const height = Math.max(24, Math.round(asset.height * scale));

      const node = createImageNode({
        assetId: asset.id,
        x: Math.round(centre.x - width / 2),
        y: Math.round(centre.y - height / 2),
        width,
        height,
        name: asset.name,
      });

      const next = addNode(current, node);
      commit({
        ...next,
        assets: current.assets.some((entry) => entry.id === asset.id)
          ? next.assets
          : [...next.assets, asset],
      });
      setSelection([node.id]);
      return node.id;
    },
    [commit],
  );

  const duplicateSelection = useCallback(() => {
    if (selection.length === 0) return;
    const result = duplicateNodes(documentRef.current, selection);
    if (result.createdIds.length === 0) return;
    commit(result.document);
    setSelection(result.createdIds);
  }, [commit, selection]);

  const deleteSelection = useCallback(() => {
    if (selection.length === 0) return;
    commit(removeNodes(documentRef.current, selection));
    setSelection([]);
  }, [commit, selection]);

  const toggleLocked = useCallback(() => {
    const selected = new Set(selection);
    if (selected.size === 0) return;
    const current = documentRef.current;
    const nodes = current.nodes.map((node) =>
      selected.has(node.id) ? { ...node, locked: !node.locked } : node,
    );
    commit({ ...current, nodes, updatedAt: new Date().toISOString() });
  }, [commit, selection]);

  const toggleHidden = useCallback(() => {
    const selected = new Set(selection);
    if (selected.size === 0) return;
    const current = documentRef.current;
    const nodes = current.nodes.map((node) =>
      selected.has(node.id) ? { ...node, hidden: !node.hidden } : node,
    );
    commit({ ...current, nodes, updatedAt: new Date().toISOString() });
  }, [commit, selection]);

  const reorder = useCallback(
    (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => {
      commit(reorderNode(documentRef.current, id, direction));
    },
    [commit],
  );

  const align = useCallback(
    (mode: AlignMode) => {
      if (selection.length === 0) return;
      commit(alignSelection(documentRef.current, selection, mode));
    },
    [commit, selection],
  );

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (selection.length === 0) return;
      commit(moveNodes(documentRef.current, selection, { x: dx, y: dy }));
    },
    [commit, selection],
  );

  const updateSelected = useCallback(
    (patch: NodePatch) => {
      if (selection.length === 0) return;
      const current = documentRef.current;
      const nodes = current.nodes.map((node) =>
        selection.includes(node.id) ? applyPatch(node, patch) : node,
      );
      commit({ ...current, nodes, updatedAt: new Date().toISOString() });
    },
    [commit, selection],
  );

  const replaceDocument = useCallback((next: CreativeDocument) => {
    historyRef.current.reset(next);
    documentRef.current = next;
    setHistoryState({ canUndo: false, canRedo: false });
    setDocument(next);
    setSelection([]);
    setRevision((count) => count + 1);
    setSaveState('saved');
  }, []);

  const selectedNodes = useMemo(
    () => document.nodes.filter((node) => selection.includes(node.id)),
    [document.nodes, selection],
  );

  return {
    document,
    selection,
    selectedNodes,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    saveState,
    revision,
    select,
    commit,
    beginGesture: (key: string) => historyRef.current.beginGesture(key),
    endGesture: () => historyRef.current.endGesture(),
    undo,
    redo,
    saveNow,
    addText,
    addShape,
    addImage,
    duplicateSelection,
    deleteSelection,
    toggleLocked,
    toggleHidden,
    reorder,
    align,
    nudge,
    updateSelected,
    replaceDocument,
  };
}

export type { CreativeTextNode, CreativeShapeNode, CreativeImageNode, FontFamilyId };
export { updateNode };
