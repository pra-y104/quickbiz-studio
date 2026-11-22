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
import { toDocPixels } from '@quickbiz/shared';
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
  /**
   * Produce a thumbnail for the saved record. Omitting it keeps any existing
   * thumbnail; the interface must then label the placeholder honestly.
   */
  readonly createThumbnail?: (
    document: CreativeDocument,
  ) => Promise<string | undefined> | string | undefined;
  /** Called when another tab reports a newer save for this project. */
  readonly onRemoteSave?: (projectId: string) => void;
  /** Channel name used to announce saves to other tabs. */
  readonly broadcastChannelName?: string;
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
  /** Delete the current selection; returns how many layers were removed. */
  deleteSelection(): number;
  /** Toggle a specific layer, or the whole selection when no id is given. */
  toggleLocked(id?: string): void;
  toggleHidden(id?: string): void;
  /** Delete specific layers. Locked layers are never removed. */
  /** Delete specific layers; returns how many were removed. */
  deleteNodes(ids: readonly string[]): number;
  reorder(id: string, direction: 'front' | 'back' | 'forward' | 'backward'): void;
  align(mode: AlignMode): void;
  nudge(dx: number, dy: number): void;
  updateSelected(patch: NodePatch): void;
  /** Change document-level settings such as the page background. */
  updateCanvas(patch: Partial<Pick<CreativeDocument['canvas'], 'background'>>): void;
  replaceDocument(next: CreativeDocument): void;
}

/** Broadcast channel used to tell other tabs that a project was just saved. */
let activeChannel: BroadcastChannel | null = null;

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

/** Canvas centre in document pixels, which is what node coordinates use. */
function centreOfCanvas(document: CreativeDocument): { x: number; y: number } {
  const pixels = toDocPixels(document.canvas);
  return { x: pixels.width / 2, y: pixels.height / 2 };
}

export function useStudioEditor(options: UseStudioEditorOptions): StudioEditor {
  const { projectId, initial, store } = options;
  const autosaveDelay = options.autosaveDelayMs ?? AUTOSAVE_DELAY_MS;
  const createThumbnail = options.createThumbnail;
  const onRemoteSave = options.onRemoteSave;
  const broadcastChannelName = options.broadcastChannelName ?? 'quickbiz-creative';

  const historyRef = useRef<DocumentHistory>(new DocumentHistory(initial));
  const [document, setDocument] = useState<CreativeDocument>(initial);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [saveState, setSaveState] = useState<StudioSaveState>('saved');
  const [revision, setRevision] = useState(0);

  // The live document mirror. It is written in every mutator, never during render.
  const documentRef = useRef<CreativeDocument>(initial);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  // Module-scoped rather than a ref: reading a ref from a callback trips the
  // React compiler lint, and only one editor is mounted at a time.
  const projectIdRef = useRef(projectId);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const announce = useCallback((id: string) => {
    if (!activeChannel) return;
    try {
      activeChannel.postMessage({ type: 'saved', projectId: id, at: Date.now() });
    } catch {
      // A closed channel is not an error worth surfacing to the customer.
    }
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    if (!broadcastChannelName) return;

    const channel = new BroadcastChannel(broadcastChannelName);
    activeChannel = channel;

    channel.onmessage = (event: MessageEvent<{ type?: string; projectId?: string }>) => {
      const data = event.data;
      if (!data || data.type !== 'saved' || data.projectId !== projectIdRef.current) return;
      onRemoteSave?.(projectIdRef.current);
    };

    return () => {
      channel.close();
      if (activeChannel === channel) activeChannel = null;
    };
  }, [broadcastChannelName, onRemoteSave]);

  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<{ snapshot: CreativeDocument; revision: number } | null>(null);

  // Save ordering. Autosave is asynchronous (it reads the existing record and renders
  // a thumbnail), so two saves can otherwise finish out of order and an older
  // snapshot can overwrite a newer one. Writes are chained, and a queued write that is
  // older than the newest accepted revision is dropped instead of being written.
  const revisionRef = useRef(0);
  const queuedRevisionRef = useRef(0);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback(
    (snapshot: CreativeDocument, savedRevision: number) => {
      const run = async () => {
        if (savedRevision < queuedRevisionRef.current) return;

        setSaveState('saving');
        try {
          const existing = await store.get(projectId);

          let thumbnail = existing?.thumbnail;
          if (createThumbnail) {
            const generated = await createThumbnail(snapshot);
            if (generated !== undefined) thumbnail = generated;
          }

          const record: CreativeProjectRecord = {
            id: projectId,
            title: snapshot.title,
            document: snapshot,
            ...(thumbnail === undefined ? {} : { thumbnail }),
            createdAt: existing?.createdAt ?? snapshot.createdAt,
            updatedAt: new Date().toISOString(),
          };
          await store.put(record);
          announce(projectId);

          // Only the newest revision may report success.
          if (savedRevision === revisionRef.current) setSaveState('saved');
        } catch {
          if (savedRevision === revisionRef.current) setSaveState('error');
        }
      };

      // Chain onto the previous write; a rejection must not break the chain.
      const next = saveChainRef.current.then(run, run);
      saveChainRef.current = next.catch(() => undefined);
      return next;
    },
    [announce, createThumbnail, projectId, store],
  );

  const scheduleSave = useCallback(
    (snapshot: CreativeDocument, savedRevision: number) => {
      queuedRevisionRef.current = Math.max(queuedRevisionRef.current, savedRevision);
      pendingSave.current = { snapshot, revision: savedRevision };
      setSaveState('saving');

      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        const pending = pendingSave.current;
        pendingSave.current = null;
        if (pending) void persist(pending.snapshot, pending.revision);
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
        if (pending) void persist(pending.snapshot, pending.revision);
      }
    };
  }, [persist]);

  // A hidden or closing page gets one immediate flush attempt. IndexedDB writes
  // are asynchronous, so this is best-effort; the debounce is the normal path and a
  // hard close can still lose the last few hundred milliseconds of work.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const pending = pendingSave.current;
      pendingSave.current = null;
      if (pending) void persist(pending.snapshot, pending.revision);
    };

    const onVisibility = () => {
      if (globalThis.document?.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    globalThis.document?.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      globalThis.document?.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persist]);

  // Second line of defence for project switching. The studio route keys the editor
  // by project id, but a cached navigation can re-render the same component with a
  // different document; without this the old state would be autosaved over the new
  // project. Detect the change and reset the history rather than trusting the key.
  const loadedIdRef = useRef(initial.id);
  useEffect(() => {
    if (loadedIdRef.current === initial.id) return;
    loadedIdRef.current = initial.id;

    historyRef.current.reset(initial);
    documentRef.current = initial;
    revisionRef.current += 1;
    queuedRevisionRef.current = revisionRef.current;
    setDocument(initial);
    setSelection([]);
    setHistoryState({ canUndo: false, canRedo: false });
    setSaveState('saved');
  }, [initial]);

  const commit = useCallback(
    (next: CreativeDocument, commitOptions: { readonly historyKey?: string } = {}) => {
      const current = historyRef.current;
      current.commit(next, { key: commitOptions.historyKey });
      const value = current.current;
      documentRef.current = value;
      revisionRef.current += 1;
      setHistoryState({ canUndo: current.canUndo, canRedo: current.canRedo });
      setDocument(value);
      setRevision((count) => count + 1);
      setSelection((ids) => {
        const present = new Set(value.nodes.map((node) => node.id));
        const kept = ids.filter((id) => present.has(id));
        return kept.length === ids.length ? ids : kept;
      });
      scheduleSave(value, revisionRef.current);
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
    revisionRef.current += 1;
    setHistoryState({ canUndo: historyRef.current.canUndo, canRedo: historyRef.current.canRedo });
    setDocument(value);
    setRevision((count) => count + 1);
    scheduleSave(value, revisionRef.current);
  }, [scheduleSave]);

  const redo = useCallback(() => {
    const value = historyRef.current.redo();
    if (!value) return;
    documentRef.current = value;
    revisionRef.current += 1;
    setHistoryState({ canUndo: historyRef.current.canUndo, canRedo: historyRef.current.canRedo });
    setDocument(value);
    setRevision((count) => count + 1);
    scheduleSave(value, revisionRef.current);
  }, [scheduleSave]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSave.current;
    pendingSave.current = null;
    queuedRevisionRef.current = Math.max(queuedRevisionRef.current, revisionRef.current);
    await persist(pending?.snapshot ?? documentRef.current, revisionRef.current);
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

  const toggleLocked = useCallback(
    (id?: string) => {
      const targets = new Set(id === undefined ? selection : [id]);
      if (targets.size === 0) return;
      const current = documentRef.current;
      const nodes = current.nodes.map((node) =>
        targets.has(node.id) ? { ...node, locked: !node.locked } : node,
      );
      commit({ ...current, nodes, updatedAt: new Date().toISOString() });
    },
    [commit, selection],
  );

  const toggleHidden = useCallback(
    (id?: string) => {
      const targets = new Set(id === undefined ? selection : [id]);
      if (targets.size === 0) return;
      const current = documentRef.current;
      const nodes = current.nodes.map((node) =>
        targets.has(node.id) ? { ...node, hidden: !node.hidden } : node,
      );
      commit({ ...current, nodes, updatedAt: new Date().toISOString() });
    },
    [commit, selection],
  );

  /**
   * Delete specific layers.
   *
   * Returns the number of layers actually removed. Locked layers are protected, so a
   * caller can tell the difference between "deleted" and "refused because locked".
   */
  const deleteNodes = useCallback(
    (ids: readonly string[]) => {
      if (ids.length === 0) return 0;

      const current = documentRef.current;
      const targets = new Set(ids);
      const removable = current.nodes.filter((node) => targets.has(node.id) && !node.locked);

      if (removable.length === 0) return 0;

      const next = removeNodes(current, ids);
      if (next === current) return 0;

      commit(next);
      setSelection((selected) => selected.filter((id) => !targets.has(id)));
      return removable.length;
    },
    [commit],
  );

  const deleteSelection = useCallback(() => {
    if (selection.length === 0) return 0;
    return deleteNodes(selection);
  }, [deleteNodes, selection]);

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

  const updateCanvas = useCallback(
    (patch: Partial<Pick<CreativeDocument['canvas'], 'background'>>) => {
      const current = documentRef.current;
      const canvas = { ...current.canvas, ...patch };
      commit({ ...current, canvas, updatedAt: new Date().toISOString() });
    },
    [commit],
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
    deleteNodes,
    reorder,
    align,
    nudge,
    updateSelected,
    updateCanvas,
    replaceDocument,
  };
}

export type { CreativeTextNode, CreativeShapeNode, CreativeImageNode, FontFamilyId };
export { updateNode };
