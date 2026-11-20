/**
 * Application-level Creative Studio storage.
 *
 * One project store and one asset store per tab. The getters are lazy so opening
 * the studio is the first thing that touches IndexedDB; nothing in the marketing
 * pages pays for it.
 */

import { createIndexedDbAssetStore, type AssetStore } from './asset-store';
import { createIndexedDbProjectStore, type CreativeProjectStore } from './project-store';

let projectStore: CreativeProjectStore | undefined;
let assetStore: AssetStore | undefined;

export function getProjectStore(): CreativeProjectStore {
  projectStore ??= createIndexedDbProjectStore();
  return projectStore;
}

export function getAssetStore(): AssetStore {
  assetStore ??= createIndexedDbAssetStore();
  return assetStore;
}

/** Test seam: replace the stores and clear the memoised instances. */
export function setCreativeStores(stores: {
  projects: CreativeProjectStore;
  assets: AssetStore;
}): void {
  projectStore = stores.projects;
  assetStore = stores.assets;
}

export function resetCreativeStores(): void {
  projectStore = undefined;
  assetStore = undefined;
}

export type {
  CreativeProjectRecord,
  CreativeProjectStore,
  CreativeProjectSummary,
} from './project-store';
export type { AssetStore, StoredAsset } from './asset-store';
