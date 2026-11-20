import { describe, expect, it } from 'vitest';
import {
  ASSET_LIMITS,
  ImageIngestError,
  assertImageDimensions,
  assertSupportedImage,
  sniffImageMime,
} from '../assets/ingest';

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP_MAGIC = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const HTML_BYTES = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
const SVG_BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');

describe('sniffImageMime', () => {
  it('recognises PNG, JPEG and WebP by signature', () => {
    expect(sniffImageMime(PNG_MAGIC)).toBe('image/png');
    expect(sniffImageMime(JPEG_MAGIC)).toBe('image/jpeg');
    expect(sniffImageMime(WEBP_MAGIC)).toBe('image/webp');
  });

  it('rejects HTML and SVG content', () => {
    expect(sniffImageMime(HTML_BYTES)).toBeNull();
    expect(sniffImageMime(SVG_BYTES)).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(sniffImageMime(new Uint8Array())).toBeNull();
  });
});

describe('assertSupportedImage', () => {
  it('accepts a genuine PNG', () => {
    expect(assertSupportedImage(PNG_MAGIC, PNG_MAGIC.length)).toBe('image/png');
  });

  it('rejects an empty file', () => {
    expect(() => assertSupportedImage(new Uint8Array(), 0)).toThrow(ImageIngestError);
    try {
      assertSupportedImage(new Uint8Array(), 0);
    } catch (error) {
      expect((error as ImageIngestError).code).toBe('empty-file');
    }
  });

  it('rejects a file above the size ceiling', () => {
    expect(() => assertSupportedImage(PNG_MAGIC, ASSET_LIMITS.maxFileBytes + 1)).toThrow(
      /larger than/,
    );
  });

  it('rejects content that is not a supported image', () => {
    try {
      assertSupportedImage(HTML_BYTES, HTML_BYTES.length);
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ImageIngestError);
      expect((error as ImageIngestError).code).toBe('unsupported-type');
    }
  });
});

describe('assertImageDimensions', () => {
  it('accepts a normal image', () => {
    expect(() => assertImageDimensions(1200, 800)).not.toThrow();
  });

  it('rejects a zero or non-finite dimension', () => {
    const cases: ReadonlyArray<readonly [number, number]> = [
      [0, 100],
      [100, 0],
      [Number.NaN, 100],
    ];
    for (const [width, height] of cases) {
      expect(() => assertImageDimensions(width, height)).toThrow(ImageIngestError);
    }
  });

  it('rejects an excessive pixel count even when each side is small enough', () => {
    expect(() =>
      assertImageDimensions(ASSET_LIMITS.maxDimension, ASSET_LIMITS.maxDimension),
    ).toThrow(/too many pixels/);
  });

  it('rejects an excessive single dimension', () => {
    expect(() => assertImageDimensions(ASSET_LIMITS.maxDimension + 1, 10)).toThrow(/too large/);
  });
});
