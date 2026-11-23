/**
 * Video Studio document model.
 *
 * A versioned, serialisable description of a video project: tracks, clips,
 * text overlays and timing. The renderer, the timeline UI, persistence and
 * import/export all speak this format, so a document can be validated once and
 * trusted everywhere — exactly like the Creative Studio document model.
 *
 * Rules enforced here:
 *
 * - The document is data, never code. There is no `src`, `url` or `html` field a
 *   clip can use to make the app fetch something.
 * - Media is referenced by `assetId`; the bytes live in the app's asset store.
 * - Node types are a closed set. Unknown types are rejected, not ignored.
 * - Sizes and durations are capped so a hostile or corrupt file cannot exhaust
 *   memory or produce an unbounded recording.
 * - An unsupported `version` is rejected explicitly, never silently coerced.
 *
 * Timing is integer milliseconds. A clip's `startMs` is its position on the
 * timeline; `durationMs` is how long it plays; `trimStartMs` is the offset into
 * the source media that playback begins at.
 */

import { z } from 'zod';

export const VIDEO_DOCUMENT_KIND = 'video-document.v1' as const;
export const VIDEO_DOCUMENT_VERSION = 1 as const;

export const VIDEO_LIMITS = {
  maxTracks: 12,
  maxClipsPerTrack: 100,
  maxWidth: 3840,
  maxHeight: 2160,
  minDimension: 2,
  minFps: 1,
  maxFps: 60,
  maxDurationMs: 15 * 60 * 1000,
  maxTitleLength: 120,
  maxTextLength: 500,
  minClipMs: 20,
  maxTrimMs: 60 * 60 * 1000,
} as const;

export const VIDEO_FPS_OPTIONS = [24, 25, 30, 50, 60] as const;
export type VideoFps = (typeof VIDEO_FPS_OPTIONS)[number];

export const TRACK_KINDS = ['video', 'audio', 'text'] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

/* -------------------------------------------------------------------------- */
/* Clips                                                                       */
/* -------------------------------------------------------------------------- */

const baseClip = {
  id: z.string().min(1).max(120),
  startMs: z.number().int().min(0).max(VIDEO_LIMITS.maxDurationMs),
  durationMs: z.number().int().min(VIDEO_LIMITS.minClipMs).max(VIDEO_LIMITS.maxDurationMs),
  /** Offset into the source media in milliseconds. */
  trimStartMs: z.number().int().min(0).max(VIDEO_LIMITS.maxTrimMs),
};

/** A clip that plays a media asset (video or audio). */
export const mediaClipSchema = z
  .object({
    ...baseClip,
    type: z.literal('media'),
    assetId: z.string().min(1).max(120),
    /** Optional display label; never a URL. */
    label: z.string().max(VIDEO_LIMITS.maxTitleLength).optional(),
    /**
     * Supported transition at the clip edges. Only a fade is implemented; the
     * option exists so the timeline and the exporter agree on what is rendered.
     * Optional so older project files still parse; absence means no transition.
     */
    transition: z.enum(['none', 'fade']).optional(),
    /** Fade length in milliseconds. Clamped by the renderer to the clip length. */
    transitionMs: z.number().int().min(0).max(2_000).optional(),
  })
  .strict();

export type MediaClip = z.infer<typeof mediaClipSchema>;

const TEXT_STYLES = ['title', 'subtitle', 'caption'] as const;
export const VIDEO_TEXT_STYLES = TEXT_STYLES;
export type VideoTextStyle = (typeof TEXT_STYLES)[number];

/** A text overlay rendered above the video. */
export const textClipSchema = z
  .object({
    ...baseClip,
    type: z.literal('text'),
    text: z.string().min(1).max(VIDEO_LIMITS.maxTextLength),
    style: z.enum(TEXT_STYLES).default('caption'),
  })
  .strict();

export type TextClip = z.infer<typeof textClipSchema>;

export const videoClipSchema = z.discriminatedUnion('type', [mediaClipSchema, textClipSchema]);
export type VideoClip = z.infer<typeof videoClipSchema>;

/* -------------------------------------------------------------------------- */
/* Tracks                                                                      */
/* -------------------------------------------------------------------------- */

export const videoTrackSchema = z
  .object({
    id: z.string().min(1).max(120),
    kind: z.enum(TRACK_KINDS),
    label: z.string().max(VIDEO_LIMITS.maxTitleLength).optional(),
    /** 0..1; ignored for text tracks. */
    volume: z.number().min(0).max(1).default(1),
    muted: z.boolean().default(false),
    clips: z.array(videoClipSchema).max(VIDEO_LIMITS.maxClipsPerTrack),
  })
  .strict();

export type VideoTrack = z.infer<typeof videoTrackSchema>;

/* -------------------------------------------------------------------------- */
/* Document                                                                    */
/* -------------------------------------------------------------------------- */

export const videoDocumentSchema = z
  .object({
    kind: z.literal(VIDEO_DOCUMENT_KIND),
    version: z.literal(VIDEO_DOCUMENT_VERSION),
    id: z.string().min(1).max(120),
    title: z.string().max(VIDEO_LIMITS.maxTitleLength),
    width: z.number().int().min(VIDEO_LIMITS.minDimension).max(VIDEO_LIMITS.maxWidth),
    height: z.number().int().min(VIDEO_LIMITS.minDimension).max(VIDEO_LIMITS.maxHeight),
    fps: z
      .number()
      .int()
      .refine(
        (value) => (VIDEO_FPS_OPTIONS as readonly number[]).includes(value),
        'fps must be one of the supported rates',
      ),
    tracks: z.array(videoTrackSchema).max(VIDEO_LIMITS.maxTracks),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type VideoDocument = z.infer<typeof videoDocumentSchema>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function clipEndMs(clip: VideoClip): number {
  return clip.startMs + clip.durationMs;
}

/**
 * Opacity multiplier for a media clip at a moment in its playback, or 1.
 *
 * Only the `fade` transition is supported: the clip ramps from transparent to
 * opaque over `transitionMs` at its start and back to transparent over the same
 * length at its end. The ramp length is clamped to half the clip so a very short
 * clip still reaches full opacity in the middle.
 */
export function clipOpacityAt(clip: VideoClip, elapsedInClipMs: number): number {
  if (clip.type !== 'media' || !clip.transition || clip.transition === 'none') return 1;

  const requested = clip.transitionMs ?? 250;
  const ramp = Math.max(0, Math.min(requested, Math.floor(clip.durationMs / 2)));
  if (ramp <= 0) return 1;

  const fadeIn = Math.min(1, Math.max(0, elapsedInClipMs / ramp));
  const fadeOut = Math.min(1, Math.max(0, (clip.durationMs - elapsedInClipMs) / ramp));
  return Math.min(fadeIn, fadeOut);
}

/** The last moment any clip ends, or 0 for an empty document. */
export function documentDurationMs(document: VideoDocument): number {
  let end = 0;
  for (const track of document.tracks) {
    for (const clip of track.clips) {
      const clipEnd = clipEndMs(clip);
      if (clipEnd > end) end = clipEnd;
    }
  }
  return end;
}

/** Clips on a track that overlap the `[fromMs, toMs)` window. */
export function clipsInWindow(track: VideoTrack, fromMs: number, toMs: number): VideoClip[] {
  return track.clips.filter((clip) => clipEndMs(clip) > fromMs && clip.startMs < toMs);
}

export class VideoDocumentError extends Error {
  readonly code: 'not-found' | 'overlap' | 'invalid';
  constructor(code: VideoDocumentError['code'], message: string) {
    super(message);
    this.name = 'VideoDocumentError';
    this.code = code;
  }
}

function findClip(document: VideoDocument, clipId: string): { track: VideoTrack; clip: VideoClip } {
  for (const track of document.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return { track, clip };
  }
  throw new VideoDocumentError('not-found', 'That clip could not be found.');
}

/**
 * Split a clip at `splitMs` (absolute timeline position).
 *
 * The left half keeps the original id; the right half gets a fresh id and a
 * trim offset that continues the source. Splitting is the only edit allowed to
 * create a new clip, so it is the one place that mints an id.
 */
export function splitClip(
  document: VideoDocument,
  clipId: string,
  splitMs: number,
  newId: string,
): VideoDocument {
  const { clip } = findClip(document, clipId);
  const offset = splitMs - clip.startMs;
  if (offset < VIDEO_LIMITS.minClipMs || clip.durationMs - offset < VIDEO_LIMITS.minClipMs) {
    throw new VideoDocumentError('invalid', 'A split must leave at least one frame on each side.');
  }

  const left: VideoClip = { ...clip, durationMs: offset };
  const right: VideoClip = {
    ...clip,
    id: newId,
    startMs: splitMs,
    durationMs: clip.durationMs - offset,
    trimStartMs: clip.trimStartMs + offset,
  };

  return {
    ...document,
    tracks: document.tracks.map((track) =>
      track.clips.some((candidate) => candidate.id === clipId)
        ? {
            ...track,
            clips: track.clips.flatMap((candidate) =>
              candidate.id === clipId ? [left, right] : [candidate],
            ),
          }
        : track,
    ),
    updatedAt: new Date().toISOString(),
  };
}

/** Remove a clip by id. */
export function removeClip(document: VideoDocument, clipId: string): VideoDocument {
  return {
    ...document,
    tracks: document.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.id !== clipId),
    })),
    updatedAt: new Date().toISOString(),
  };
}

/** Append a clip to a track, shifting nothing. Overlap is allowed (layers). */
export function addClip(document: VideoDocument, trackId: string, clip: VideoClip): VideoDocument {
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track) throw new VideoDocumentError('not-found', 'That track could not be found.');
  if (track.clips.length >= VIDEO_LIMITS.maxClipsPerTrack) {
    throw new VideoDocumentError('invalid', 'That track is full.');
  }
  return {
    ...document,
    tracks: document.tracks.map((candidate) =>
      candidate.id === trackId ? { ...candidate, clips: [...candidate.clips, clip] } : candidate,
    ),
    updatedAt: new Date().toISOString(),
  };
}

/** Create an empty document with the given canvas size and frame rate. */
export function createVideoDocument(input: {
  readonly id: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly fps: VideoFps;
  readonly now?: number;
}): VideoDocument {
  const timestamp = new Date(input.now ?? Date.now()).toISOString();
  return {
    kind: VIDEO_DOCUMENT_KIND,
    version: VIDEO_DOCUMENT_VERSION,
    id: input.id,
    title: input.title,
    width: input.width,
    height: input.height,
    fps: input.fps,
    tracks: [
      { id: `${input.id}-video`, kind: 'video', volume: 1, muted: false, clips: [] },
      { id: `${input.id}-audio`, kind: 'audio', volume: 1, muted: false, clips: [] },
      { id: `${input.id}-text`, kind: 'text', volume: 1, muted: false, clips: [] },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
