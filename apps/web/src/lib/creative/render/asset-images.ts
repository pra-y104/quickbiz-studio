/**
 * Asset image loading for the renderer.
 *
 * Assets are stored as bytes in IndexedDB and decoded on demand. Results are
 * cached per asset id for the lifetime of the tab, and a failed decode resolves to
 * `null` so one bad asset cannot break a whole design.
 */

import type { AssetStore, StoredAsset } from '../storage/asset-store';

export interface LoadedAsset {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

const cache = new Map<string, Promise<LoadedAsset | null>>();

export function clearAssetCache(): void {
  cache.clear();
}

export function invalidateAsset(id: string): void {
  cache.delete(id);
}

async function decode(asset: StoredAsset): Promise<LoadedAsset | null> {
  try {
    const blob = new Blob([asset.bytes], { type: asset.mimeType });
    const bitmap = await createImageBitmap(blob);
    return { image: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    return null;
  }
}

function loadOne(store: AssetStore, id: string): Promise<LoadedAsset | null> {
  const existing = cache.get(id);
  if (existing) return existing;

  const promise = store
    .get(id)
    .then((asset) => (asset ? decode(asset) : null))
    .catch(() => null);

  cache.set(id, promise);
  return promise;
}

/** Load every asset referenced by a document. */
export async function loadAssets(
  store: AssetStore,
  ids: readonly string[],
): Promise<Map<string, LoadedAsset>> {
  const unique = [...new Set(ids)];
  const entries = await Promise.all(
    unique.map(async (id) => [id, await loadOne(store, id)] as const),
  );

  const result = new Map<string, LoadedAsset>();
  for (const [id, asset] of entries) {
    if (asset) result.set(id, asset);
  }
  return result;
}

/** Every asset id a document references, groups included. */
export function collectAssetIds(document: {
  readonly nodes: readonly {
    readonly type: string;
    readonly assetId?: string;
    readonly children?: readonly { readonly type: string; readonly assetId?: string }[];
  }[];
}): string[] {
  const ids: string[] = [];
  for (const node of document.nodes) {
    if (node.type === 'image' && node.assetId) ids.push(node.assetId);
    if (node.type === 'group' && node.children) {
      for (const child of node.children) {
        if (child.type === 'image' && child.assetId) ids.push(child.assetId);
      }
    }
  }
  return ids;
}
