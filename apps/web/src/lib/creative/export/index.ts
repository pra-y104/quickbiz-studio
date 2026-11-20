/**
 * Export orchestration.
 *
 * One entry point for all three formats so the interface, the progress state and
 * the error handling stay identical whichever format the customer picks.
 *
 * Export never mutates the design and never calls the network. Everything happens
 * on the device, which is why an export cannot fail because of a provider outage.
 */

import type { CreativeDocument } from '@quickbiz/shared';
import type { RenderAsset } from '../render/render-document';
import { buildImagePdf } from './creative-pdf';
import { ExportError, rasterise, type RasterFormat } from './raster';

export type ExportFormat = RasterFormat | 'pdf';

export interface ExportRequest {
  readonly document: CreativeDocument;
  readonly assets: ReadonlyMap<string, RenderAsset>;
  readonly format: ExportFormat;
  /** 1 = document pixels, 2 = double, 3 = print scale. */
  readonly scale: number;
  readonly transparentBackground: boolean;
}

export interface ExportResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly format: ExportFormat;
}

export function exportExtension(format: ExportFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

export function exportFilename(title: string, format: ExportFormat): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'design'}.${exportExtension(format)}`;
}

async function jpegFor(
  doc: CreativeDocument,
  assets: ReadonlyMap<string, RenderAsset>,
  scale: number,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const result = await rasterise(doc, assets, { format: 'jpeg', scale });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  return { bytes, width: result.width, height: result.height };
}

export async function exportDesign(request: ExportRequest): Promise<ExportResult> {
  const { document: doc, assets, format, scale, transparentBackground } = request;
  if (format === 'pdf') {
    const image = await jpegFor(doc, assets, scale);
    const bytes = buildImagePdf({
      canvas: doc.canvas,
      image: {
        jpegBytes: image.bytes,
        pixelWidth: image.width,
        pixelHeight: image.height,
      },
    });
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    return {
      blob,
      filename: exportFilename(doc.title, format),
      width: image.width,
      height: image.height,
      format,
    };
  }

  const result = await rasterise(doc, assets, {
    format,
    scale,
    transparentBackground: format === 'png' ? transparentBackground : false,
  });

  return {
    blob: result.blob,
    filename: exportFilename(doc.title, format),
    width: result.width,
    height: result.height,
    format,
  };
}

export { ExportError };
export type { RasterFormat };
export const EXPORT_SCALE_OPTIONS = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
] as const;
