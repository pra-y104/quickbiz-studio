import { describe, expect, it } from 'vitest';
import { createVideoDocument, addClip, type MediaClip } from '@quickbiz/shared';
import { activeClipAt, clipLayout, pixelsToTimeMs } from './timeline';

function doc() {
  return createVideoDocument({
    id: 'p1',
    title: 'T',
    width: 1280,
    height: 720,
    fps: 30,
    now: 0,
  });
}

function media(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id: 'c1',
    type: 'media',
    assetId: 'a1',
    startMs: 0,
    durationMs: 5_000,
    trimStartMs: 0,
    ...overrides,
  };
}

describe('clipLayout', () => {
  it('maps a clip to percentage position and width', () => {
    const clip = media({ startMs: 2_500, durationMs: 2_500 });
    const layout = clipLayout(clip, 10_000);
    expect(layout.leftPercent).toBeCloseTo(25, 5);
    expect(layout.widthPercent).toBeCloseTo(25, 5);
  });

  it('keeps very short clips visible', () => {
    const clip = media({ startMs: 0, durationMs: 10 });
    const layout = clipLayout(clip, 100_000);
    expect(layout.widthPercent).toBeGreaterThanOrEqual(0.4);
  });

  it('never overflows the right edge', () => {
    const clip = media({ startMs: 9_000, durationMs: 5_000 });
    const layout = clipLayout(clip, 10_000);
    expect(layout.leftPercent + layout.widthPercent).toBeLessThanOrEqual(100.0001);
  });
});

describe('pixelsToTimeMs', () => {
  it('converts a pixel position to a timeline time', () => {
    expect(pixelsToTimeMs(250, 1_000, 10_000)).toBe(2_500);
    expect(pixelsToTimeMs(0, 1_000, 10_000)).toBe(0);
    expect(pixelsToTimeMs(2_000, 1_000, 10_000)).toBe(10_000);
    expect(pixelsToTimeMs(100, 0, 10_000)).toBe(0);
  });
});

describe('activeClipAt', () => {
  it('returns the clip containing the time', () => {
    const clips = [
      media({ id: 'a', startMs: 0, durationMs: 1_000 }),
      media({ id: 'b', startMs: 1_000, durationMs: 1_000 }),
    ];
    expect(activeClipAt(clips, 500)?.id).toBe('a');
    expect(activeClipAt(clips, 1_500)?.id).toBe('b');
    expect(activeClipAt(clips, 5_000)).toBeNull();
  });
});

describe('document integration', () => {
  it('builds a document with clips and finds the active clip', () => {
    const d = doc();
    const withClip = addClip(d, d.tracks[0]!.id, media({ durationMs: 3_000 }));
    const mediaClips = withClip.tracks[0]!.clips;
    expect(activeClipAt(mediaClips, 1_000)?.id).toBe('c1');
  });
});
