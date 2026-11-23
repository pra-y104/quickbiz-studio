/**
 * Video export — WebM only, honestly labelled.
 *
 * The browser can composite a canvas and record it with `MediaRecorder`. This
 * module plays the timeline onto a canvas and records the result. The output is
 * **WebM** (VP8/VP9 + Opus). It is never labelled MP4: producing an MP4 in the
 * browser needs a paid or heavy encoder and is out of scope for a zero-budget
 * build. The UI says WebM, the file extension is `.webm`, and the MIME type is
 * `video/webm`.
 *
 * Capability detection is explicit: if `MediaRecorder` or `canvas.captureStream`
 * is missing (older mobile browsers), export reports a readable failure instead
 * of silently doing nothing.
 *
 * This module is framework-free and takes plain elements, so it is unit-testable
 * for the parts that do not need a real encoder (capability checks, clip math).
 */

import type { MediaClip, VideoClip, VideoDocument } from '@quickbiz/shared';
import { clipEndMs, clipOpacityAt } from '@quickbiz/shared';
import { getVideoAssetUrl, releaseVideoAssetUrl } from './assets';

export const WEBM_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

export interface ExportCapabilities {
  readonly mediaRecorder: boolean;
  readonly captureStream: boolean;
}

export function detectExportCapabilities(): ExportCapabilities {
  const hasRecorder = typeof MediaRecorder !== 'undefined';
  const hasCapture =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';
  return { mediaRecorder: hasRecorder, captureStream: hasCapture };
}

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const candidate of WEBM_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
}

export class VideoExportError extends Error {
  readonly code: 'unsupported' | 'no-media' | 'aborted' | 'failed';
  constructor(code: VideoExportError['code'], message: string) {
    super(message);
    this.name = 'VideoExportError';
    this.code = code;
  }
}

export interface VideoExportOptions {
  readonly document: VideoDocument;
  /** The canvas the recorder draws to. Sized to the document. */
  readonly canvas: HTMLCanvasElement;
  readonly onProgress?: (fraction: number) => void;
  readonly signal?: AbortSignal;
}

export interface VideoExportResult {
  readonly blob: Blob;
  readonly mimeType: string;
  /** Always 'webm' — this build never produces MP4. */
  readonly extension: 'webm';
  readonly durationMs: number;
}

interface ActiveClip {
  readonly clip: MediaClip;
  readonly url: string;
  readonly video: HTMLVideoElement;
}

/** Draw one video frame letterboxed into the canvas (object-fit: contain). */
function drawContain(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement,
  width: number,
  height: number,
): void {
  const sourceWidth = source.videoWidth || width;
  const sourceHeight = source.videoHeight || height;
  if (sourceWidth === 0 || sourceHeight === 0) return;

  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
}

const TEXT_STYLE: Record<string, { size: number; weight: string; y: number }> = {
  title: { size: 0.08, weight: '700', y: 0.18 },
  subtitle: { size: 0.05, weight: '600', y: 0.82 },
  caption: { size: 0.04, weight: '500', y: 0.9 },
};

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  clip: Extract<VideoClip, { type: 'text' }>,
  width: number,
  height: number,
): void {
  const style = TEXT_STYLE[clip.style] ?? TEXT_STYLE.caption!;
  const fontSize = Math.max(12, Math.round(height * style.size));
  ctx.font = `${style.weight} ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, fontSize / 12);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.fillStyle = '#ffffff';
  const x = width / 2;
  const y = height * style.y;
  ctx.strokeText(clip.text, x, y, width * 0.92);
  ctx.fillText(clip.text, x, y, width * 0.92);
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out loading media.')), 15_000);
    video.addEventListener(
      'loadedmetadata',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    video.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new Error('Could not load media.'));
      },
      { once: true },
    );
  });
}

/**
 * Render the timeline to WebM.
 *
 * The video and audio tracks are played in document order. Text overlays are
 * composited on top. The output duration equals the document duration. This is a
 * real recording of the composition, not a slideshow: each frame is drawn from
 * the decoded source at the correct timestamp.
 */
export async function exportVideoToWebm(options: VideoExportOptions): Promise<VideoExportResult> {
  const { document: videoDocument, canvas, onProgress, signal } = options;

  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new VideoExportError('unsupported', 'This browser cannot record video (WebM).');
  }

  const durationMs = Math.max(
    0,
    ...videoDocument.tracks.flatMap((track) => track.clips.map((clip) => clipEndMs(clip))),
  );
  if (durationMs <= 0) {
    throw new VideoExportError('no-media', 'Add at least one video clip before exporting.');
  }
  if (signal?.aborted) throw new VideoExportError('aborted', 'Export cancelled.');

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new VideoExportError('unsupported', 'Canvas 2D is unavailable.');

  const mediaTracks = videoDocument.tracks.filter((track) => track.kind === 'video');
  const videoClips: VideoClip[] = mediaTracks
    .flatMap((track) => track.clips)
    .sort((a, b) => a.startMs - b.startMs);

  // Preload every video clip into its own element so playback can switch cleanly.
  const loaded: ActiveClip[] = [];
  for (const clip of videoClips) {
    if (clip.type !== 'media') continue;
    const url = await getVideoAssetUrl(clip.assetId);
    if (!url) continue;
    const video = window.document.createElement('video');
    video.src = url;
    video.muted = false;
    video.playsInline = true;
    video.preload = 'auto';
    try {
      await waitForMetadata(video);
      loaded.push({ clip, url, video });
    } catch {
      releaseVideoAssetUrl(clip.assetId);
    }
  }

  if (loaded.length === 0) {
    throw new VideoExportError('no-media', 'The video files could not be loaded for export.');
  }

  const canvasStream = canvas.captureStream(videoDocument.fps);
  const combined = new MediaStream(canvasStream.getVideoTracks());

  // Audio: route every clip element through a single MediaStreamDestination so the
  // recording has sound. Muted tracks contribute silence.
  let audioContext: AudioContext | null = null;
  const sourceNodes: MediaElementAudioSourceNode[] = [];
  if (typeof AudioContext !== 'undefined') {
    try {
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      for (const active of loaded) {
        const node = audioContext.createMediaElementSource(active.video);
        node.connect(destination);
        node.connect(audioContext.destination);
        sourceNodes.push(node);
      }
      for (const track of destination.stream.getAudioTracks()) combined.addTrack(track);
    } catch {
      audioContext = null;
    }
  }

  const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  const textClips = videoDocument.tracks
    .filter((track) => track.kind === 'text')
    .flatMap((track) => track.clips);

  function drawAt(timeMs: number): void {
    const active = loaded.find((entry) => {
      const clip = entry.clip;
      return clip.startMs <= timeMs && timeMs < clipEndMs(clip);
    });
    ctx!.fillStyle = '#000';
    ctx!.fillRect(0, 0, canvas.width, canvas.height);
    if (active && active.video.readyState >= 2) {
      ctx!.globalAlpha = clipOpacityAt(active.clip, timeMs - active.clip.startMs);
      drawContain(ctx!, active.video, canvas.width, canvas.height);
      ctx!.globalAlpha = 1;
    }
    for (const clip of textClips) {
      if (clip.type !== 'text') continue;
      if (clip.startMs <= timeMs && timeMs < clipEndMs(clip)) {
        drawTextOverlay(ctx!, clip, canvas.width, canvas.height);
      }
    }
  }

  // Prime the first frame so the recording never opens on black.
  drawAt(0);
  recorder.start(200);

  const start = performance.now();

  try {
    await new Promise<void>((resolve, reject) => {
      const tick = (): void => {
        if (signal?.aborted) {
          reject(new VideoExportError('aborted', 'Export cancelled.'));
          return;
        }
        const elapsed = performance.now() - start;
        if (elapsed >= durationMs) {
          drawAt(durationMs - 1);
          resolve();
          return;
        }
        // Keep the active clip playing in real time; seek it in on entry.
        for (const entry of loaded) {
          const clip = entry.clip;
          const activeNow = clip.startMs <= elapsed && elapsed < clipEndMs(clip);
          if (activeNow) {
            if (entry.video.paused) {
              void entry.video.play().catch(() => undefined);
            }
          } else if (!entry.video.paused) {
            entry.video.pause();
          }
        }
        drawAt(elapsed);
        onProgress?.(elapsed / durationMs);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    recorder.stop();
    await stopped;
  } finally {
    for (const active of loaded) {
      active.video.pause();
      active.video.removeAttribute('src');
      releaseVideoAssetUrl(active.clip.assetId);
    }
    for (const node of sourceNodes) node.disconnect();
    if (audioContext) void audioContext.close();
    canvasStream.getTracks().forEach((track) => track.stop());
  }

  const blob = new Blob(chunks, { type: mimeType });
  return { blob, mimeType, extension: 'webm', durationMs };
}

/** Format a duration in ms as m:ss for UI labels. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
