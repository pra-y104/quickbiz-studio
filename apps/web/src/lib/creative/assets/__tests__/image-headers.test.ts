import { describe, expect, it } from 'vitest';
import { readImageDimensions } from '../image-headers';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, APP0 (small), SOF0 with dimensions, EOI.
  const bytes = new Uint8Array(64);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  bytes[4] = 0x00;
  bytes[5] = 0x04;
  bytes[6] = 0x00;
  bytes[7] = 0x00;
  bytes[8] = 0xff;
  bytes[9] = 0xc0;
  bytes[10] = 0x00;
  bytes[11] = 0x0b;
  bytes[12] = 0x08;

  const view = new DataView(bytes.buffer);
  view.setUint16(13, height);
  view.setUint16(15, width);
  bytes[17] = 0x01;
  bytes[18] = 0x01;
  bytes[19] = 0x11;
  bytes[20] = 0x00;

  return bytes;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);

  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  bytes[24] = widthMinusOne & 0xff;
  bytes[25] = (widthMinusOne >> 8) & 0xff;
  bytes[26] = (widthMinusOne >> 16) & 0xff;
  bytes[27] = heightMinusOne & 0xff;
  bytes[28] = (heightMinusOne >> 8) & 0xff;
  bytes[29] = (heightMinusOne >> 16) & 0xff;

  return bytes;
}

describe('readImageDimensions', () => {
  it('reads PNG dimensions from the header', () => {
    expect(readImageDimensions(png(1_200, 800), 'image/png')).toEqual({
      width: 1_200,
      height: 800,
    });
  });

  it('reads JPEG dimensions from the SOF marker', () => {
    expect(readImageDimensions(jpeg(640, 480), 'image/jpeg')).toEqual({ width: 640, height: 480 });
  });

  it('reads WebP (VP8X) dimensions', () => {
    expect(readImageDimensions(webpVp8x(1_080, 1_350), 'image/webp')).toEqual({
      width: 1_080,
      height: 1_350,
    });
  });

  it('returns null for a truncated PNG header', () => {
    expect(readImageDimensions(new Uint8Array([0x89, 0x50]), 'image/png')).toBeNull();
  });

  it('returns null when no SOF marker is present', () => {
    const bytes = new Uint8Array(10);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    expect(readImageDimensions(bytes, 'image/jpeg')).toBeNull();
  });

  it('returns null for an unrecognised WebP chunk', () => {
    const bytes = webpVp8x(10, 10);
    bytes.set([0x58, 0x59, 0x5a, 0x00], 12);
    expect(readImageDimensions(bytes, 'image/webp')).toBeNull();
  });

  it('reports an excessive declared size so the caller can reject it early', () => {
    const dimensions = readImageDimensions(png(20_000, 20_000), 'image/png');
    expect(dimensions).toEqual({ width: 20_000, height: 20_000 });
    expect((dimensions?.width ?? 0) * (dimensions?.height ?? 0)).toBeGreaterThan(24_000_000);
  });

  it('does not throw on arbitrary bytes', () => {
    expect(() => readImageDimensions(new Uint8Array(64).fill(0xff), 'image/png')).not.toThrow();
  });
});
