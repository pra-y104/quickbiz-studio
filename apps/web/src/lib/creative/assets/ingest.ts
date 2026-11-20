/**
 * Upload validation and ingestion.
 *
 * Uploaded files are untrusted input. Three checks run before an image is ever
 * shown:
 *
 * 1. **Signature sniffing.** The declared MIME type and the file extension are
 *    ignored; the first bytes decide the type. A `.png` that is really HTML is
 *    rejected.
 * 2. **Size and pixel ceilings.** Checked against the file size and the decoded
 *    dimensions, so a small file that expands to 200 megapixels is still refused.
 * 3. **Re-encode.** The decoded bitmap is drawn to a canvas and exported again,
 *    which drops EXIF (including GPS) and any payload hidden in metadata blocks.
 *
 * SVG is deliberately not accepted: it is a document format that can carry
 * scripts and external references, and sanitising it correctly is a separate,
 * reviewed piece of work.
 */

import { createAssetId, type CreativeAssetRef } from '@quickbiz/shared';

export const ASSET_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxPixels: 24_000_000,
  maxDimension: 12_000,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;

export type AllowedImageMime = (typeof ASSET_LIMITS.allowedMimeTypes)[number];

export type ImageIngestErrorCode =
  | 'empty-file'
  | 'unsupported-type'
  | 'too-large'
  | 'too-many-pixels'
  | 'decode-failed'
  | 'encode-failed';

export class ImageIngestError extends Error {
  readonly code: ImageIngestErrorCode;

  constructor(code: ImageIngestErrorCode, message: string) {
    super(message);
    this.name = 'ImageIngestError';
    this.code = code;
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Identify an image by its magic bytes.
 *
 * This is the only source of truth for the type: browsers report MIME types
 * from the filename, which the customer controls.
 */
export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/** Reject anything that is not a supported raster image, before decoding. */
export function assertSupportedImage(bytes: Uint8Array, declaredSize: number): AllowedImageMime {
  if (bytes.length === 0) {
    throw new ImageIngestError('empty-file', 'That file is empty.');
  }
  if (declaredSize > ASSET_LIMITS.maxFileBytes) {
    throw new ImageIngestError(
      'too-large',
      `That image is larger than ${Math.round(ASSET_LIMITS.maxFileBytes / (1024 * 1024))} MB.`,
    );
  }
  const mime = sniffImageMime(bytes);
  if (!mime) {
    throw new ImageIngestError(
      'unsupported-type',
      'Use a JPEG, PNG or WebP image. SVG and other formats are not accepted.',
    );
  }
  return mime;
}

/** Pixel ceilings, checked against the decoded bitmap rather than the file. */
export function assertImageDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ImageIngestError('decode-failed', 'That image could not be read.');
  }
  if (width > ASSET_LIMITS.maxDimension || height > ASSET_LIMITS.maxDimension) {
    throw new ImageIngestError('too-many-pixels', 'That image is too large to edit safely.');
  }
  if (width * height > ASSET_LIMITS.maxPixels) {
    throw new ImageIngestError(
      'too-many-pixels',
      'That image has too many pixels to edit safely on this device.',
    );
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageIngestError('encode-failed', 'That image could not be re-encoded.'));
      },
      mime,
      quality,
    );
  });
}

/** PNG is always available; WebP encoding depends on the browser. */
async function encode(canvas: HTMLCanvasElement, mime: AllowedImageMime): Promise<Blob> {
  const target = mime === 'image/webp' ? 'image/webp' : mime;
  const blob = await canvasToBlob(canvas, target, mime === 'image/png' ? undefined : 0.92);
  if (blob.type === 'image/png' && mime !== 'image/png') {
    // The browser silently fell back to PNG; keep the bytes, record the real type.
    return blob;
  }
  return blob;
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

export interface IngestedImage {
  readonly asset: CreativeAssetRef;
  readonly bytes: Uint8Array;
  readonly mimeType: AllowedImageMime;
}

export interface IngestImageOptions {
  readonly name: string;
  /** Optional ceiling override, used by tests and future quota work. */
  readonly maxFileBytes?: number;
}

/**
 * Validate, decode and re-encode an uploaded image.
 *
 * Returns bytes plus an asset reference; the caller stores them and puts the
 * reference in the document. The original file is never kept.
 */
export async function ingestImage(
  file: Blob,
  options: IngestImageOptions,
): Promise<IngestedImage> {
  const declaredSize = file.size;
  const limit = options.maxFileBytes ?? ASSET_LIMITS.maxFileBytes;
  if (declaredSize > limit) {
    throw new ImageIngestError(
      'too-large',
      `That image is larger than ${Math.round(limit / (1024 * 1024))} MB.`,
    );
  }

  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const mime = assertSupportedImage(sourceBytes, declaredSize);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageIngestError(
      'decode-failed',
      'That file could not be decoded as an image, so it was not added.',
    );
  }

  try {
    assertImageDimensions(bitmap.width, bitmap.height);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new ImageIngestError('encode-failed', 'This browser could not process the image.');
    }
    context.drawImage(bitmap, 0, 0);

    const blob = await encode(canvas, mime);
    const bytes = await blobToBytes(blob);
    const finalMime = sniffImageMime(bytes) ?? mime;

    return {
      bytes,
      mimeType: finalMime,
      asset: {
        id: createAssetId(),
        name: options.name.slice(0, 120) || 'Image',
        mimeType: finalMime,
        width: bitmap.width,
        height: bitmap.height,
        bytes: bytes.byteLength,
      },
    };
  } finally {
    bitmap.close();
  }
}