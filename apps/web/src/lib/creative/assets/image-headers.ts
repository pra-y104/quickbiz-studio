/**
 * Read image dimensions from file headers, without decoding.
 *
 * A 10 MB image can decode to hundreds of megapixels, so checking the declared
 * dimensions *before* `createImageBitmap` avoids the largest allocation an upload
 * can trigger. The parser is deliberately small and conservative: anything it does
 * not recognise returns `null`, and the caller falls back to the decode-time check.
 *
 * This is a mitigation, not a sandbox. A file can still lie about its dimensions in
 * a way only the decoder discovers, so the post-decode check remains in place.
 */

import type { AllowedImageMime } from './ingest';

export interface HeaderDimensions {
  readonly width: number;
  readonly height: number;
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  const high = bytes[offset];
  const low = bytes[offset + 1];
  if (high === undefined || low === undefined) return 0;
  return (high << 8) | low;
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) return 0;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

/** PNG: IHDR is always the first chunk, so the size is at a fixed offset. */
function pngDimensions(bytes: Uint8Array): HeaderDimensions | null {
  if (bytes.length < 24) return null;
  const width = readUInt32BE(bytes, 16);
  const height = readUInt32BE(bytes, 20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

/** JPEG: scan markers for a Start-Of-Frame segment. */
function jpegDimensions(bytes: Uint8Array): HeaderDimensions | null {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === undefined) return null;

    // Standalone markers without a payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = readUInt16BE(bytes, offset + 2);
    if (length < 2) return null;

    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isStartOfFrame) {
      const height = readUInt16BE(bytes, offset + 5);
      const width = readUInt16BE(bytes, offset + 7);
      if (width < 1 || height < 1) return null;
      return { width, height };
    }

    offset += 2 + length;
  }

  return null;
}

/** WebP: VP8X, VP8 (lossy) and VP8L (lossless) carry the size differently. */
function webpDimensions(bytes: Uint8Array): HeaderDimensions | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));

  if (chunk === 'VP8X') {
    const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16);
    const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16);
    return width > 1 && height > 1 ? { width, height } : null;
  }

  if (chunk === 'VP8 ') {
    const width = readUInt16BE(bytes, 26) & 0x3fff;
    const height = readUInt16BE(bytes, 28) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (chunk === 'VP8L') {
    const bits = readUInt32BE(bytes, 21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }

  return null;
}

/** Best-effort dimension read; `null` means "let the decoder decide". */
export function readImageDimensions(
  bytes: Uint8Array,
  mime: AllowedImageMime,
): HeaderDimensions | null {
  try {
    if (mime === 'image/png') return pngDimensions(bytes);
    if (mime === 'image/jpeg') return jpegDimensions(bytes);
    return webpDimensions(bytes);
  } catch {
    return null;
  }
}
