/**
 * Project thumbnails.
 *
 * A thumbnail is a real render of the document through the same renderer the
 * editor and exporter use, downscaled and encoded as JPEG. If rendering fails for
 * any reason the caller stores no thumbnail and the project card falls back to a
 * labelled preset description — never a fabricated preview.
 */

import { toDocPixels, type CreativeDocument } from '@quickbiz/shared';
import { renderDocument, type RenderAsset } from './render-document';

export const THUMBNAIL_WIDTH = 480;

export function renderThumbnail(
  doc: CreativeDocument,
  assets: ReadonlyMap<string, RenderAsset>,
  maxWidth = THUMBNAIL_WIDTH,
): string | undefined {
  try {
    const pixels = toDocPixels(doc.canvas);
    const scale = Math.min(1, maxWidth / pixels.width);
    const width = Math.max(1, Math.round(pixels.width * scale));
    const height = Math.max(1, Math.round(pixels.height * scale));

    const canvas = window.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    context.setTransform(scale, 0, 0, scale, 0, 0);
    renderDocument(context, doc, { assets, showSelection: false });

    const url = canvas.toDataURL('image/jpeg', 0.72);
    return url.length > 0 ? url : undefined;
  } catch {
    return undefined;
  }
}
