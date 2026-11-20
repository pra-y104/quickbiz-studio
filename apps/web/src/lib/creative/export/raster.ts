/**
 * Raster export.
 *
 * The same renderer the editor uses draws into an off-screen canvas at the chosen
 * scale, so an export cannot drift from what the customer sees. Two guards keep an
 * export from exhausting the device:
 *
 * - a maximum output size (40 megapixels),
 * - a maximum edge of 12,000 px, which is beyond any supported preset.
 *
 * Background transparency is opt-in and only honoured for PNG, because JPEG has no
 * alpha channel and would silently render transparency as black.
 */

import { toDocPixels, type CreativeDocument } from '@quickbiz/shared';
import type { RenderAsset } from '../render/render-document';
import { renderDocument } from '../render/render-document';

export const EXPORT_LIMITS = {
  maxPixels: 40_000_000,
  maxEdge: 12_000,
} as const;

export type RasterFormat = 'png' | 'jpeg';

export interface RasterOptions {
  readonly format: RasterFormat;
  /** 1 = document pixels. 2 = double. */
  readonly scale: number;
  readonly transparentBackground?: boolean;
}

export interface RasterResult {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
}

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

export function assertExportSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ExportError('That export size is not valid.');
  }
  if (Math.max(width, height) > EXPORT_LIMITS.maxEdge) {
    throw new ExportError('That export is too large for this device. Choose a smaller size.');
  }
  if (width * height > EXPORT_LIMITS.maxPixels) {
    throw new ExportError('That export is too large for this device. Choose a smaller size.');
  }
}

function toBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ExportError('The browser could not create the export.'));
      },
      mimeType,
      quality,
    );
  });
}

export async function rasterise(
  doc: CreativeDocument,
  assets: ReadonlyMap<string, RenderAsset>,
  options: RasterOptions,
): Promise<RasterResult> {
  const pixels = toDocPixels(doc.canvas);
  const scale = Math.min(Math.max(options.scale, 0.25), 8);
  const width = Math.round(pixels.width * scale);
  const height = Math.round(pixels.height * scale);

  assertExportSize(width, height);

  const canvas = window.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new ExportError('This browser could not create an export canvas.');

  const transparent = options.format === 'png' && options.transparentBackground === true;

  context.setTransform(scale, 0, 0, scale, 0, 0);
  renderDocument(context, doc, { assets, showSelection: false, skipBackground: transparent });

  const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await toBlob(canvas, mimeType, options.format === 'jpeg' ? 0.92 : undefined);

  return { blob, width, height, mimeType };
}
