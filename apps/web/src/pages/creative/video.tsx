/* eslint-disable react-hooks/preserve-manual-memoization -- the editor keeps refs and async
   playback/export loops; the manual memoisation here is deliberate and load-bearing. */
/* eslint-disable react-hooks/set-state-in-effect -- projects and media load on mount; the
   async refresh settles after the effect body and does not cascade a synchronous render. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Download,
  Film,
  Music,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import type { MediaClip, TextClip, VideoDocument, VideoTrack } from '@quickbiz/shared';
import {
  addClip,
  clipEndMs,
  clipOpacityAt,
  createVideoDocument,
  documentDurationMs,
  removeClip,
  serialiseVideoProjectFile,
  splitClip,
} from '@quickbiz/shared';
import { parseVideoProjectFile } from '@quickbiz/shared';
import { Container } from '../../components/ui/container';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Alert } from '../../components/ui/alert';
import { Spinner } from '../../components/ui/spinner';
import { listVideoProjects, loadVideoProject, saveVideoProject } from '../../lib/video/storage';
import { getVideoAssetUrl, storeVideoAsset } from '../../lib/video/assets';
import {
  detectExportCapabilities,
  exportVideoToWebm,
  formatDuration,
  VideoExportError,
} from '../../lib/video/export';
import { activeClipAt, clipLayout, pixelsToTimeMs } from '../../lib/video/timeline';
import { createVideoId } from '../../lib/video/id';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

function probeMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
    const cleanup = (): void => {
      URL.revokeObjectURL(url);
      element.removeAttribute('src');
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(0);
    }, 10_000);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const duration = Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : 0;
      window.clearTimeout(timer);
      cleanup();
      resolve(duration);
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(0);
    };
    element.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadProject(document: VideoDocument): void {
  const blob = new Blob([serialiseVideoProjectFile(document)], { type: 'application/json' });
  downloadBlob(blob, `${document.title || 'video'}.qbvideo`);
}

interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export function VideoStudioPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listVideoProjects();
      setProjects(list.map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt })));
      setStorageError(null);
    } catch {
      setStorageError('Video projects could not be loaded on this device.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6 text-primary" label="Loading video projects" />
      </Container>
    );
  }

  if (activeId === null) {
    return (
      <VideoProjectsView
        projects={projects}
        storageError={storageError}
        onOpen={setActiveId}
        onRefresh={refresh}
      />
    );
  }

  return (
    <VideoEditor
      key={activeId}
      projectId={activeId}
      onExit={() => {
        setActiveId(null);
        void refresh();
      }}
    />
  );
}

function VideoProjectsView({
  projects,
  storageError,
  onOpen,
  onRefresh,
}: {
  readonly projects: readonly ProjectSummary[];
  readonly storageError: string | null;
  readonly onOpen: (id: string) => void;
  readonly onRefresh: () => Promise<void>;
}) {
  const create = async (): Promise<void> => {
    const id = createVideoId();
    await saveVideoProject({
      id,
      title: 'Untitled video',
      document: createVideoDocument({
        id,
        title: 'Untitled video',
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        fps: 30,
      }),
      updatedAt: Date.now(),
    });
    await onRefresh();
    onOpen(id);
  };

  const importProjectFile = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = async (file: File): Promise<void> => {
    setImportError(null);
    let raw: string;
    try {
      raw = await file.text();
    } catch {
      setImportError('That file could not be read.');
      return;
    }
    const result = parseVideoProjectFile(raw);
    if (!result.ok || !result.project) {
      setImportError(result.error ?? 'That file is not a video project.');
      return;
    }
    const imported = result.project.document;
    // A re-imported project is stored as a new document so the original is kept.
    const id = createVideoId();
    const document: VideoDocument = {
      ...imported,
      id,
      title: `${imported.title}`.slice(0, 120) || 'Imported video',
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveVideoProject({ id, title: document.title, document, updatedAt: Date.now() });
    } catch {
      setImportError('That project could not be saved on this device.');
      return;
    }
    await onRefresh();
    onOpen(id);
  };

  return (
    <Container className="py-8 sm:py-12">
      <Link
        to="/studio"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All studios
      </Link>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Film className="size-4" aria-hidden="true" />
            Video Studio
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Video projects
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
            Multi-track editing with video, audio and text. Export is WebM — honest about the
            format, never labelled MP4.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => importProjectFile.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Import project
          </Button>
          <Button onClick={() => void create()}>
            <Plus className="size-4" aria-hidden="true" />
            New video project
          </Button>
        </div>
        <input
          ref={importProjectFile}
          type="file"
          accept=".qbvideo,application/json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.target.value = '';
          }}
        />
      </div>

      {importError ? (
        <Alert tone="danger" className="mt-4">
          {importError}
        </Alert>
      ) : null}

      {storageError ? (
        <Alert tone="warning" className="mt-6">
          {storageError}
        </Alert>
      ) : (
        <p className="mt-6 text-xs text-ink-subtle">
          Projects are stored on this device only. Nothing is uploaded.
        </p>
      )}

      {projects.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div
            className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
            aria-hidden="true"
          >
            <Film className="size-6" />
          </div>
          <h2 className="text-base font-semibold text-ink">No video projects yet</h2>
          <p className="max-w-sm text-sm text-ink-muted">
            Create a project, import your clips, arrange them on the timeline and export.
          </p>
          <Button className="mt-2" onClick={() => void create()}>
            Create your first project
          </Button>
        </Card>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onOpen(project.id)}
                className="w-full rounded-card border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-muted"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Film className="size-4 text-primary" aria-hidden="true" />
                  {project.title}
                </p>
                <p className="mt-1 text-xs text-ink-subtle">
                  {new Date(project.updatedAt).toLocaleString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

function VideoEditor({
  projectId,
  onExit,
}: {
  readonly projectId: string;
  readonly onExit: () => void;
}) {
  const [document, setDocument] = useState<VideoDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef<{ at: number; from: number } | null>(null);
  const loadedClipRef = useRef<string | null>(null);
  const activeMediaRef = useRef<{ id: string; url: string } | null>(null);
  const docRef = useRef<VideoDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadVideoProject(projectId).then((record) => {
      if (cancelled) return;
      if (record) {
        setDocument(record.document as VideoDocument);
        setSelectedId(null);
      } else {
        const created = createVideoDocument({
          id: projectId,
          title: 'Untitled video',
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          fps: 30,
        });
        setDocument(created);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    docRef.current = document;
  }, [document]);

  const duration = useMemo(() => (document ? documentDurationMs(document) : 0), [document]);

  // Preview opacity for the active media clip, so a fade transition is visible
  // while editing exactly as it will render in the export.
  const previewOpacity = useMemo(() => {
    if (!document) return 1;
    const active = document.tracks
      .filter((track) => track.kind === 'video')
      .flatMap((track) => track.clips)
      .find((clip) => clip.startMs <= playhead && playhead < clipEndMs(clip));
    if (!active) return 1;
    return clipOpacityAt(active, playhead - active.startMs);
  }, [document, playhead]);

  const persist = useCallback(async (next: VideoDocument) => {
    setSaveState('saving');
    try {
      await saveVideoProject({
        id: next.id,
        title: next.title,
        document: next,
        updatedAt: Date.now(),
      });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  const update = useCallback(
    (updater: (current: VideoDocument) => VideoDocument) => {
      setDocument((current) => {
        if (!current) return current;
        const next = updater(current);
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const selected = useMemo(() => {
    if (!document || !selectedId) return null;
    for (const track of document.tracks) {
      const clip = track.clips.find((candidate) => candidate.id === selectedId);
      if (clip) return { track, clip };
    }
    return null;
  }, [document, selectedId]);

  const syncVideoTo = useCallback((timeMs: number, doc: VideoDocument) => {
    const video = videoRef.current;
    if (!video) return;
    const mediaClips = doc.tracks
      .filter((track) => track.kind === 'video')
      .flatMap((track) => track.clips)
      .filter((clip): clip is MediaClip => clip.type === 'media');
    const active = activeClipAt(mediaClips, timeMs);
    if (!active || active.type !== 'media') {
      video.pause();
      activeMediaRef.current = null;
      return;
    }
    if (activeMediaRef.current?.id !== active.id) {
      void getVideoAssetUrl(active.assetId).then((url) => {
        if (!url || videoRef.current !== video) return;
        video.src = url;
        loadedClipRef.current = active.id;
        activeMediaRef.current = { id: active.id, url };
        const offset = active.trimStartMs + Math.max(0, timeMs - active.startMs);
        const apply = (): void => {
          try {
            video.currentTime = offset / 1000;
          } catch {
            /* seek before metadata is ignored by some browsers */
          }
        };
        if (video.readyState >= 1) apply();
        else video.addEventListener('loadedmetadata', apply, { once: true });
      });
    }
  }, []);

  // Playback loop.
  useEffect(() => {
    const video = videoRef.current;
    if (!playing || !document) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      video?.pause();
      return;
    }
    playStartRef.current = { at: performance.now(), from: playhead };
    const total = documentDurationMs(document);
    const tick = (): void => {
      const state = playStartRef.current;
      if (!state) return;
      const elapsed = state.from + (performance.now() - state.at);
      if (elapsed >= total) {
        setPlayhead(total);
        setPlaying(false);
        return;
      }
      setPlayhead(elapsed);
      syncVideoTo(elapsed, document);
      if (video && !video.paused) {
        // Nudge the playhead to the actual media clock so A/V stay in sync.
        setPlayhead(Math.max(elapsed, video.currentTime * 1000));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      video?.pause();
    };
  }, [playing, document, playhead, syncVideoTo]);

  // Load the preview asset for the initial position.
  useEffect(() => {
    if (document && !playing) syncVideoTo(playhead, document);
  }, [document, playhead, playing, syncVideoTo]);

  const handleImport = async (files: FileList): Promise<void> => {
    const doc = docRef.current;
    if (!doc) return;
    let next = doc;
    for (const file of Array.from(files)) {
      const isAudio = file.type.startsWith('audio');
      const assetId = createVideoId();
      try {
        await storeVideoAsset({ id: assetId, name: file.name, type: file.type, blob: file });
      } catch {
        setNotice('Could not store that file on this device.');
        continue;
      }
      const durationMs = await probeMediaDuration(file);
      const kind = isAudio ? 'audio' : 'video';
      const track = next.tracks.find((t) => t.kind === kind) ?? next.tracks[0]!;
      const start = track.clips.reduce((end, clip) => Math.max(end, clipEndMs(clip)), 0);
      const clip: MediaClip = {
        id: createVideoId(),
        type: 'media',
        assetId,
        startMs: start,
        durationMs: Math.min(Math.max(durationMs, 20), 15 * 60 * 1000),
        trimStartMs: 0,
        label: file.name.slice(0, 120),
      };
      next = addClip(next, track.id, clip);
      setSelectedId(clip.id);
    }
    setDocument(next);
    void persist(next);
  };

  const addText = (): void => {
    const doc = docRef.current;
    if (!doc) return;
    const track = doc.tracks.find((t) => t.kind === 'text');
    if (!track) return;
    const clip: TextClip = {
      id: createVideoId(),
      type: 'text',
      text: 'Your text here',
      style: 'caption',
      startMs: Math.round(playhead),
      durationMs: 3_000,
      trimStartMs: 0,
    };
    const next = addClip(doc, track.id, clip);
    setDocument(next);
    setSelectedId(clip.id);
    void persist(next);
  };

  const doSplit = (): void => {
    const doc = docRef.current;
    if (!doc || !selectedId) return;
    const splitAt = Math.round(playhead);
    try {
      const next = splitClip(doc, selectedId, splitAt, createVideoId());
      setDocument(next);
      setSelectedId(null);
      void persist(next);
    } catch {
      setNotice('Move the playhead inside the selected clip to split it.');
    }
  };

  const doDelete = (): void => {
    const doc = docRef.current;
    if (!doc || !selectedId) return;
    const next = removeClip(doc, selectedId);
    setDocument(next);
    setSelectedId(null);
    void persist(next);
  };

  const updateSelected = (patch: Partial<MediaClip> & Partial<TextClip>): void => {
    if (!selected) return;
    const { track, clip } = selected;
    const merged = { ...clip, ...patch } as typeof clip;
    const next: VideoDocument = {
      ...document!,
      tracks: document!.tracks.map((t) =>
        t.id === track.id
          ? { ...t, clips: t.clips.map((c) => (c.id === clip.id ? merged : c)) }
          : t,
      ),
      updatedAt: new Date().toISOString(),
    };
    setDocument(next);
    void persist(next);
  };

  const doExport = async (): Promise<void> => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    const caps = detectExportCapabilities();
    if (!caps.mediaRecorder || !caps.captureStream) {
      setNotice('This browser cannot export video (WebM). Try a recent Chrome or Edge.');
      return;
    }
    canvas.width = doc.width;
    canvas.height = doc.height;
    setPlaying(false);
    setExporting(true);
    setExportProgress(0);
    try {
      const result = await exportVideoToWebm({
        document: doc,
        canvas,
        onProgress: setExportProgress,
      });
      downloadBlob(result.blob, `${doc.title || 'video'}.webm`);
      setNotice('Export complete — WebM downloaded.');
    } catch (error) {
      const message =
        error instanceof VideoExportError ? error.message : 'Export failed. Please try again.';
      setNotice(message);
    } finally {
      setExporting(false);
    }
  };

  if (!document) {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-6 text-primary" label="Loading project" />
      </Container>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onExit} aria-label="Back to video projects">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <input
            aria-label="Project title"
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-ink hover:border-border focus:border-border focus:outline-none"
            value={document.title}
            maxLength={120}
            onChange={(event) => {
              const title = event.target.value;
              update((current) => ({ ...current, title, updatedAt: new Date().toISOString() }));
            }}
          />
          <span className="text-xs text-ink-subtle" role="status">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved on device'
                : saveState === 'error'
                  ? 'Not saved'
                  : ''}
          </span>
          <Button variant="outline" size="sm" onClick={() => downloadProject(document)}>
            <Download className="size-4" aria-hidden="true" />
            Project
          </Button>
          <Button size="sm" onClick={() => void doExport()} loading={exporting}>
            <Download className="size-4" aria-hidden="true" />
            {exporting ? `Exporting ${Math.round(exportProgress * 100)}%` : 'Export WebM'}
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[220px_1fr_260px]">
        {/* Media / tracks */}
        <aside className="space-y-3">
          <Card>
            <CardContent className="space-y-2 p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="size-4" aria-hidden="true" />
                Import media
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={addText}>
                <Type className="size-4" aria-hidden="true" />
                Add text
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="video/*,audio/*"
                multiple
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files) void handleImport(event.target.files);
                  event.target.value = '';
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Tracks
              </h2>
              {document.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </CardContent>
          </Card>
        </aside>

        {/* Preview + timeline */}
        <section className="space-y-3">
          <div
            className="relative overflow-hidden rounded-card bg-black"
            style={{ aspectRatio: `${document.width} / ${document.height}` }}
          >
            <video
              ref={videoRef}
              className="size-full object-contain"
              playsInline
              aria-label="Video preview"
              style={{ opacity: previewOpacity }}
            />
            {document.tracks
              .filter((track) => track.kind === 'text')
              .flatMap((track) => track.clips)
              .filter((clip): clip is TextClip => clip.type === 'text')
              .filter((clip) => clip.startMs <= playhead && playhead < clipEndMs(clip))
              .map((clip) => (
                <p
                  key={clip.id}
                  className="pointer-events-none absolute inset-x-0 px-4 text-center font-semibold text-white drop-shadow"
                  style={{
                    top: clip.style === 'title' ? '12%' : clip.style === 'subtitle' ? '78%' : '86%',
                    fontSize:
                      clip.style === 'title' ? '8%' : clip.style === 'subtitle' ? '5%' : '4%',
                  }}
                >
                  {clip.text}
                </p>
              ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (playing) setPlaying(false);
                else {
                  if (playhead >= duration) setPlayhead(0);
                  setPlaying(true);
                }
              }}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <Pause className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={doSplit} disabled={!selectedId}>
              <Scissors className="size-4" aria-hidden="true" />
              Split
            </Button>
            <Button size="sm" variant="outline" onClick={doDelete} disabled={!selectedId}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
            <span className="ml-auto text-xs tabular-nums text-ink-muted">
              {formatDuration(playhead)} / {formatDuration(duration)}
            </span>
          </div>

          <div
            className="relative rounded-card border border-border bg-surface p-2"
            role="presentation"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setPlayhead(pixelsToTimeMs(event.clientX - rect.left, rect.width, duration));
            }}
          >
            {document.tracks.map((track) => (
              <div
                key={track.id}
                className="relative mb-1 h-12 overflow-hidden rounded bg-canvas last:mb-0"
              >
                {track.clips.map((clip) => {
                  const layout = clipLayout(clip, duration);
                  const isSelected = clip.id === selectedId;
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(clip.id);
                      }}
                      className={`absolute top-1 flex h-10 items-center overflow-hidden rounded px-2 text-left text-[11px] ${
                        clip.type === 'text'
                          ? 'bg-primary-soft text-primary'
                          : track.kind === 'audio'
                            ? 'bg-accent-soft text-ink'
                            : 'bg-surface-muted text-ink'
                      } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                      style={{ left: `${layout.leftPercent}%`, width: `${layout.widthPercent}%` }}
                      title={clip.type === 'text' ? clip.text : (clip.label ?? clip.assetId)}
                    >
                      <span className="truncate">
                        {clip.type === 'text' ? (
                          <>
                            <Type className="mr-1 inline size-3" aria-hidden="true" />
                            {clip.text}
                          </>
                        ) : track.kind === 'audio' ? (
                          <>
                            <Music className="mr-1 inline size-3" aria-hidden="true" />
                            {clip.label ?? clip.assetId}
                          </>
                        ) : (
                          (clip.label ?? clip.assetId)
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-danger"
              style={{ left: `${duration > 0 ? Math.min(100, (playhead / duration) * 100) : 0}%` }}
              aria-hidden="true"
            />
          </div>
        </section>

        {/* Inspector */}
        <aside className="space-y-3">
          <Card>
            <CardContent className="space-y-3 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Properties
              </h2>
              {selected ? (
                <ClipInspector clip={selected.clip} onChange={updateSelected} />
              ) : (
                <p className="text-sm text-ink-muted">Select a clip to edit its timing or text.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-3 text-xs text-ink-subtle">
              <p>Export format: WebM (VP9/VP8 + Opus).</p>
              <p>No MP4. Nothing is uploaded; rendering happens on this device.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Export canvas is offscreen; sized to the document. */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {notice ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-card border border-border bg-surface px-4 py-2 text-sm text-ink shadow-elev-2"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TrackRow({
  track,
  selectedId,
  onSelect,
}: {
  readonly track: VideoTrack;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  const Icon = track.kind === 'audio' ? Music : track.kind === 'text' ? Type : Film;
  return (
    <div className="rounded-md border border-border p-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
        <Icon className="size-3.5 text-ink-subtle" aria-hidden="true" />
        {track.kind}
        <span className="ml-auto text-[10px] text-ink-subtle">{track.clips.length}</span>
      </p>
      {track.clips.length === 0 ? (
        <p className="mt-1 text-[11px] text-ink-subtle">Empty</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {track.clips.map((clip) => (
            <li key={clip.id}>
              <button
                type="button"
                onClick={() => onSelect(clip.id)}
                className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] ${
                  clip.id === selectedId
                    ? 'bg-primary-soft text-primary'
                    : 'text-ink-muted hover:bg-surface-muted'
                }`}
              >
                {clip.type === 'text' ? clip.text : (clip.label ?? clip.assetId)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClipInspector({
  clip,
  onChange,
}: {
  readonly clip: MediaClip | TextClip;
  readonly onChange: (patch: Partial<MediaClip> & Partial<TextClip>) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      {clip.type === 'text' ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink">Text</span>
          <textarea
            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
            rows={3}
            maxLength={500}
            value={clip.text}
            onChange={(event) => onChange({ text: event.target.value })}
          />
        </label>
      ) : null}

      {clip.type === 'text' ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink">Style</span>
          <select
            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
            value={clip.style}
            onChange={(event) => onChange({ style: event.target.value as TextClip['style'] })}
          >
            <option value="title">Title</option>
            <option value="subtitle">Subtitle</option>
            <option value="caption">Caption</option>
          </select>
        </label>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink">Start (s)</span>
        <input
          type="number"
          min={0}
          step={0.1}
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
          value={Math.round((clip.startMs / 1000) * 10) / 10}
          onChange={(event) =>
            onChange({ startMs: Math.max(0, Math.round(Number(event.target.value) * 1000)) })
          }
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink">Duration (s)</span>
        <input
          type="number"
          min={0.02}
          step={0.1}
          className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
          value={Math.round((clip.durationMs / 1000) * 100) / 100}
          onChange={(event) =>
            onChange({ durationMs: Math.max(20, Math.round(Number(event.target.value) * 1000)) })
          }
        />
      </label>

      {clip.type === 'media' ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink">Trim start (s)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
            value={Math.round((clip.trimStartMs / 1000) * 10) / 10}
            onChange={(event) =>
              onChange({ trimStartMs: Math.max(0, Math.round(Number(event.target.value) * 1000)) })
            }
          />
        </label>
      ) : null}

      {clip.type === 'media' && clip.id !== '' ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink">Transition</span>
          <select
            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
            value={clip.transition ?? 'none'}
            onChange={(event) =>
              onChange({ transition: event.target.value === 'fade' ? 'fade' : 'none' })
            }
          >
            <option value="none">None (hard cut)</option>
            <option value="fade">Fade</option>
          </select>
          <span className="block text-[11px] text-ink-subtle">
            Fade is the only transition supported; the export applies it identically.
          </span>
        </label>
      ) : null}
    </div>
  );
}
