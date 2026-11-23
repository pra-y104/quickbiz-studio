/**
 * Video project storage.
 *
 * A dedicated IndexedDB database, kept separate from the Creative Studio database
 * so a video project can never collide with a design project and so the two can
 * be versioned independently. Mirrors the durability rule used by the creative
 * store: a write resolves only after the transaction commits.
 */

const DATABASE_NAME = 'quickbiz-video';
export const DATABASE_VERSION = 1;

export const VIDEO_PROJECT_STORE = 'projects';

let databasePromise: Promise<IDBDatabase> | undefined;

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export class VideoStorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoStorageUnavailableError';
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(
      new VideoStorageUnavailableError('This browser cannot store projects on this device.'),
    );
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VIDEO_PROJECT_STORE)) {
        database.createObjectStore(VIDEO_PROJECT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open storage.'));
    request.onblocked = () => reject(new Error('Storage is blocked by another tab.'));
  });

  return databasePromise;
}

interface StoredVideoProject {
  id: string;
  title: string;
  document: unknown;
  updatedAt: number;
}

export async function saveVideoProject(project: StoredVideoProject): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VIDEO_PROJECT_STORE, 'readwrite');
    transaction.objectStore(VIDEO_PROJECT_STORE).put(project);
    // Resolve on commit, not request success, so a later abort is not a false save.
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Could not save the project.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('The save was interrupted.'));
  });
}

export async function loadVideoProject(id: string): Promise<StoredVideoProject | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VIDEO_PROJECT_STORE, 'readonly');
    const request = transaction.objectStore(VIDEO_PROJECT_STORE).get(id);
    request.onsuccess = () => resolve((request.result as StoredVideoProject | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not load the project.'));
  });
}

export async function listVideoProjects(): Promise<StoredVideoProject[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VIDEO_PROJECT_STORE, 'readonly');
    const request = transaction.objectStore(VIDEO_PROJECT_STORE).getAll();
    request.onsuccess = () => {
      const projects = (request.result as StoredVideoProject[]) ?? [];
      projects.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(projects);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not list projects.'));
  });
}

export async function deleteVideoProject(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VIDEO_PROJECT_STORE, 'readwrite');
    transaction.objectStore(VIDEO_PROJECT_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Could not delete the project.'));
  });
}
