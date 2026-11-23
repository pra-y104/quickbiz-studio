/**
 * Video asset store.
 *
 * Imported video and audio files are kept as Blobs in IndexedDB so a project can
 * be reopened offline and exported without re-uploading. Object URLs are created
 * on demand and cached so repeated playback of the same clip does not re-decode.
 */

import { isIndexedDbAvailable, VideoStorageUnavailableError } from './storage';

const DATABASE_NAME = 'quickbiz-video';
export const VIDEO_ASSET_STORE = 'assets';

let databasePromise: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new VideoStorageUnavailableError('Storage is unavailable.'));
  }
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VIDEO_ASSET_STORE)) {
        database.createObjectStore(VIDEO_ASSET_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open storage.'));
  });
  return databasePromise;
}

export interface VideoAssetRecord {
  id: string;
  name: string;
  type: string;
  blob: Blob;
}

export async function storeVideoAsset(record: VideoAssetRecord): Promise<void> {
  const database = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VIDEO_ASSET_STORE, 'readwrite');
    transaction.objectStore(VIDEO_ASSET_STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not store the file.'));
  });
}

export async function getVideoAsset(id: string): Promise<VideoAssetRecord | null> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VIDEO_ASSET_STORE, 'readonly');
    const request = transaction.objectStore(VIDEO_ASSET_STORE).get(id);
    request.onsuccess = () => resolve((request.result as VideoAssetRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not read the file.'));
  });
}

const urlCache = new Map<string, string>();

/** Return a cached object URL for an asset, creating it once. */
export async function getVideoAssetUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const record = await getVideoAsset(id);
  if (!record) return null;
  const url = URL.createObjectURL(record.blob);
  urlCache.set(id, url);
  return url;
}

export function releaseVideoAssetUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

export function releaseAllVideoAssetUrls(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}
