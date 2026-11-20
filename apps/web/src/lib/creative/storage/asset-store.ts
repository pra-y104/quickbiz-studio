/**
 * Asset storage.
 *
 * Uploaded images are kept as raw bytes in IndexedDB and referenced from a
 * document by id only. Nothing here fetches a URL: there is no code path that
 * turns a document field into a network request.
 */

import { ASSET_STORE, openDatabase, runRequest } from './idb';

export interface StoredAsset {
  readonly id: string;
  readonly name: string;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly bytes: ArrayBuffer;
  readonly width: number;
  readonly height: number;
  readonly createdAt: string;
}

export interface AssetStore {
  readonly persistent: boolean;
  put(asset: StoredAsset): Promise<void>;
  get(id: string): Promise<StoredAsset | null>;
  remove(id: string): Promise<void>;
}

export function createIndexedDbAssetStore(): AssetStore {
  return {
    persistent: true,
    async put(asset) {
      const database = await openDatabase();
      await runRequest<IDBValidKey>({
        database,
        store: ASSET_STORE,
        mode: 'readwrite',
        operation: (store) => store.put(asset),
      });
    },
    async get(id) {
      const database = await openDatabase();
      const asset = await runRequest<StoredAsset | undefined>({
        database,
        store: ASSET_STORE,
        mode: 'readonly',
        operation: (store) => store.get(id) as IDBRequest<StoredAsset | undefined>,
      });
      return asset ?? null;
    },
    async remove(id) {
      const database = await openDatabase();
      await runRequest<undefined>({
        database,
        store: ASSET_STORE,
        mode: 'readwrite',
        operation: (store) => store.delete(id) as IDBRequest<undefined>,
      });
    },
  };
}

/** In-memory store for tests. */
export function createInMemoryAssetStore(
  initial: readonly StoredAsset[] = [],
): AssetStore & { assets: StoredAsset[] } {
  const assets = [...initial];
  return {
    persistent: false,
    assets,
    async put(asset) {
      const index = assets.findIndex((candidate) => candidate.id === asset.id);
      if (index >= 0) assets[index] = asset;
      else assets.push(asset);
    },
    async get(id) {
      return assets.find((asset) => asset.id === id) ?? null;
    },
    async remove(id) {
      const index = assets.findIndex((asset) => asset.id === id);
      if (index >= 0) assets.splice(index, 1);
    },
  };
}
