/**
 * Timeline layout helpers.
 *
 * Pure functions that map a clip's timeline position to a percentage of the
 * project width, so the visual timeline and the export share one source of
 * truth. Kept separate from React so the math is unit-testable.
 */

import { clipEndMs, type VideoClip } from '@quickbiz/shared';

export interface ClipLayout {
  readonly leftPercent: number;
  readonly widthPercent: number;
}

/** Position and width of a clip within a timeline of `durationMs`. */
export function clipLayout(clip: VideoClip, durationMs: number): ClipLayout {
  const safeDuration = durationMs > 0 ? durationMs : 1;
  const left = (clip.startMs / safeDuration) * 100;
  const width = (clip.durationMs / safeDuration) * 100;
  return {
    leftPercent: Math.min(100, Math.max(0, left)),
    // Keep a sliver visible for very short clips without exceeding the track.
    widthPercent: Math.min(100 - Math.min(100, Math.max(0, left)), Math.max(0.4, width)),
  };
}

/** Convert a pixel position within a track to a timeline time in ms. */
export function pixelsToTimeMs(offsetX: number, trackWidthPx: number, durationMs: number): number {
  if (trackWidthPx <= 0 || durationMs <= 0) return 0;
  const fraction = Math.min(1, Math.max(0, offsetX / trackWidthPx));
  return Math.round(fraction * durationMs);
}

/** The clip on a track that contains `timeMs`, or null. Later clips win on ties. */
export function activeClipAt(clips: readonly VideoClip[], timeMs: number): VideoClip | null {
  let found: VideoClip | null = null;
  for (const clip of clips) {
    if (clip.startMs <= timeMs && timeMs < clipEndMs(clip)) found = clip;
  }
  return found;
}
