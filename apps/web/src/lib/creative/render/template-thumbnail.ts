/**
 * Rendered template thumbnails.
 *
 * A thumbnail is a real render of the template document through the same renderer
 * the editor and the exporter use, downscaled and encoded once. Results are cached
 * by template id for the lifetime of the tab, so scrolling the gallery does not
 * re-render canvases.
 *
 * Rendering is client-side and local: no template is fetched, and no image leaves
 * the device.
 */

import { createDocumentFromTemplate, type CreativeTemplate } from '@quickbiz/shared';
import { renderDocument, type RenderAsset } from './render-document';

export const TEMPLATE_THUMB_WIDTH = 480;

const cache = new Map<string, string>();
const EMPTY_ASSETS: ReadonlyMap<string, RenderAsset> = new Map();

export function getCachedTemplateThumbnail(id: string): string | undefined {
  return cache.get(id);
}

export function clearTemplateThumbnailCache(): void {
  cache.clear();
}

/**
 * Render one template preview.
 *
 * Returns `undefined` when the browser cannot provide a 2D context, so the caller
 * can fall back to a labelled placeholder rather than showing an empty box.
 */
export function renderTemplateThumbnail(
  template: CreativeTemplate,
  maxWidth = TEMPLATE_THUMB_WIDTH,
): string | undefined {
  const cached = cache.get(template.id);
  if (cached) return cached;

  try {
    const document = createDocumentFromTemplate(template.id);
    const canvas = window.document.createElement('canvas');
    const ratio = Math.min(1, maxWidth / document.canvas.width);
    const width = Math.max(1, Math.round(document.canvas.width * ratio));
    const height = Math.max(1, Math.round(document.canvas.height * ratio));

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    renderDocument(context, document, { assets: EMPTY_ASSETS, showSelection: false });

    const url = canvas.toDataURL('image/webp', 0.8);
    const result = url.startsWith('data:image/webp') ? url : canvas.toDataURL('image/png');

    cache.set(template.id, result);
    return result;
  } catch {
    return undefined;
  }
}
