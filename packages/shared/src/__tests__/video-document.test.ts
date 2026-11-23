import { describe, expect, it } from 'vitest';
import {
  addClip,
  clipOpacityAt,
  clipsInWindow,
  createVideoDocument,
  documentDurationMs,
  removeClip,
  splitClip,
  videoDocumentSchema,
  VIDEO_LIMITS,
  type MediaClip,
  type TextClip,
  type VideoDocument,
} from '../video/document';
import { parseVideoProjectFile, serialiseVideoProjectFile } from '../video/project-file';

function mediaClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id: 'clip-1',
    type: 'media',
    assetId: 'asset-1',
    startMs: 0,
    durationMs: 3_000,
    trimStartMs: 0,
    ...overrides,
  };
}

function textClip(overrides: Partial<TextClip> = {}): TextClip {
  return {
    id: 'text-1',
    type: 'text',
    text: 'Hello',
    style: 'caption',
    startMs: 500,
    durationMs: 1_000,
    trimStartMs: 0,
    ...overrides,
  };
}

function doc(): VideoDocument {
  return createVideoDocument({
    id: 'proj-1',
    title: 'Demo',
    width: 1920,
    height: 1080,
    fps: 30,
    now: 0,
  });
}

describe('video document helpers', () => {
  it('computes the document duration from the latest clip end', () => {
    const document = doc();
    const withClips = addClip(document, document.tracks[0]!.id, mediaClip({ durationMs: 2_000 }));
    expect(documentDurationMs(withClips)).toBe(2_000);
  });

  it('reports clips overlapping a time window', () => {
    const document = doc();
    const track = document.tracks[0]!;
    const withClips = {
      ...document,
      tracks: [
        {
          ...track,
          clips: [
            mediaClip({ id: 'a', startMs: 0, durationMs: 1_000 }),
            mediaClip({ id: 'b', startMs: 2_000, durationMs: 1_000 }),
          ],
        },
      ],
    };
    expect(clipsInWindow(withClips.tracks[0]!, 0, 500).map((c) => c.id)).toEqual(['a']);
    expect(clipsInWindow(withClips.tracks[0]!, 1_500, 2_500).map((c) => c.id)).toEqual(['b']);
  });
});

describe('splitClip', () => {
  it('splits a clip into two with a continued trim offset', () => {
    const document = doc();
    const track = document.tracks[0]!;
    const withClip = addClip(
      document,
      track.id,
      mediaClip({ durationMs: 4_000, trimStartMs: 1_000 }),
    );
    const split = splitClip(withClip, 'clip-1', 1_500, 'clip-2');

    const clips = split.tracks[0]!.clips;
    expect(clips).toHaveLength(2);
    const [left, right] = clips;
    expect(left!.id).toBe('clip-1');
    expect(left!.durationMs).toBe(1_500);
    expect(left!.trimStartMs).toBe(1_000);
    expect(right!.id).toBe('clip-2');
    expect(right!.startMs).toBe(1_500);
    expect(right!.durationMs).toBe(2_500);
    expect(right!.trimStartMs).toBe(2_500);
  });

  it('rejects a split that leaves too little on either side', () => {
    const document = doc();
    const withClip = addClip(document, document.tracks[0]!.id, mediaClip({ durationMs: 1_000 }));
    expect(() => splitClip(withClip, 'clip-1', 5, 'x')).toThrow();
  });
});

describe('addClip', () => {
  it('appends a text overlay to the text track', () => {
    const document = doc();
    const textTrack = document.tracks.find((track) => track.kind === 'text')!;
    const withText = addClip(document, textTrack.id, textClip());
    const clips = withText.tracks.find((track) => track.kind === 'text')!.clips;
    expect(clips).toHaveLength(1);
    expect(clips[0]!.type).toBe('text');
  });
});

describe('clipOpacityAt', () => {
  it('is fully opaque for a hard cut', () => {
    const clip = mediaClip({ durationMs: 2_000 });
    expect(clipOpacityAt(clip, 0)).toBe(1);
    expect(clipOpacityAt(clip, 1_000)).toBe(1);
  });

  it('ramps in and out for a fade transition', () => {
    const clip = mediaClip({ durationMs: 2_000, transition: 'fade', transitionMs: 500 });
    expect(clipOpacityAt(clip, 0)).toBeCloseTo(0, 5);
    expect(clipOpacityAt(clip, 250)).toBeCloseTo(0.5, 5);
    expect(clipOpacityAt(clip, 1_000)).toBeCloseTo(1, 5);
    expect(clipOpacityAt(clip, 1_750)).toBeCloseTo(0.5, 5);
    expect(clipOpacityAt(clip, 2_000)).toBeCloseTo(0, 5);
  });

  it('clamps the ramp to half the clip so a short clip still reaches full opacity', () => {
    const clip = mediaClip({ durationMs: 200, transition: 'fade', transitionMs: 2_000 });
    // ramp = min(2000, 100) = 100; at the midpoint the clip is fully opaque.
    expect(clipOpacityAt(clip, 100)).toBeCloseTo(1, 5);
    expect(clipOpacityAt(clip, 50)).toBeCloseTo(0.5, 5);
  });

  it('does not fade a text clip', () => {
    const clip = textClip();
    expect(clipOpacityAt(clip, 10)).toBe(1);
  });
});

describe('removeClip', () => {
  it('removes a clip by id and leaves the document valid', () => {
    const document = doc();
    const withClip = addClip(document, document.tracks[0]!.id, mediaClip());
    const removed = removeClip(withClip, 'clip-1');
    expect(removed.tracks[0]!.clips).toHaveLength(0);
    expect(videoDocumentSchema.safeParse(removed).success).toBe(true);
  });
});

describe('video document schema', () => {
  it('accepts a valid document', () => {
    const document = doc();
    const withClip = addClip(document, document.tracks[0]!.id, mediaClip());
    expect(videoDocumentSchema.safeParse(withClip).success).toBe(true);
  });

  it('rejects an unsupported fps', () => {
    const document = { ...doc(), fps: 45 };
    expect(videoDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects a document with an unknown clip type', () => {
    const document = doc();
    const bad = {
      ...document,
      tracks: [
        {
          ...document.tracks[0]!,
          clips: [{ id: 'x', type: 'evil', startMs: 0, durationMs: 1_000, trimStartMs: 0 }],
        },
      ],
    };
    expect(videoDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects more tracks than the cap', () => {
    const document = doc();
    const many = {
      ...document,
      tracks: Array.from({ length: VIDEO_LIMITS.maxTracks + 1 }, (_, i) => ({
        id: `t-${i}`,
        kind: 'video' as const,
        volume: 1,
        muted: false,
        clips: [],
      })),
    };
    expect(videoDocumentSchema.safeParse(many).success).toBe(false);
  });
});

describe('video project file', () => {
  it('round-trips a document through serialise and parse', () => {
    const document = doc();
    const withClip = addClip(document, document.tracks[0]!.id, mediaClip());
    const serialised = serialiseVideoProjectFile(withClip);
    const parsed = parseVideoProjectFile(serialised);
    expect(parsed.ok).toBe(true);
    expect(parsed.project?.document.id).toBe(withClip.id);
  });

  it('rejects a non-JSON payload with a readable error', () => {
    const result = parseVideoProjectFile('not json');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects a payload that is not a video project file', () => {
    const result = parseVideoProjectFile(
      JSON.stringify({ kind: 'wrong', version: 1, document: doc() }),
    );
    expect(result.ok).toBe(false);
  });
});
