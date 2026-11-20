/**
 * Minimal promise wrapper over IndexedDB.
 *
 * The editor stores potentially large design documents, so localStorage is not
 * appropriate. Every call rejects with a readable error rather than hanging, and
 * `isIndexedDbAvailable()` lets the app decide whether to warn the customer that
 * their work will only last for this tab.
 */

const DATABASE_NAME = 'quickbiz-creative';
export const DATABASE_VERSION = 1;

export const PROJECT_STORE = 'projects';
export const ASSET_STORE = 'assets';

let databasePromise: Promise<IDBDatabase> | undefined;

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(
      new StorageUnavailableError('This browser cannot store projects on this device.'),
    );
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        const projects = database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        projects.createIndex('updatedAt', 'updatedAt');
      }
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };

    request.onerror = () => {
      databasePromise = undefined;
      const error = request.error;
      reject(
        new StorageUnavailableError(
          error?.message ?? 'This browser could not open local storage for projects.',
        ),
      );
    };

    request.onblocked = () => {
      databasePromise = undefined;
      reject(
        new StorageUnavailableError(
          'Local storage is blocked by another tab. Close it and try again.',
        ),
      );
    };
  });

  return databasePromise;
}

export interface RunRequest<T> {
  readonly database: IDBDatabase;
  readonly store: string;
  readonly mode: IDBTransactionMode;
  readonly operation: (store: IDBObjectStore) => IDBRequest<T>;
}

/** Run one request inside a transaction and settle with its result. */
export function runRequest<T>(options: RunRequest<T>): Promise<T> {
  const { database, store, mode, operation } = options;

  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(store, mode);
    } catch (error) {
      reject(new StorageUnavailableError(error instanceof Error ? error.message : 'Storage failed'));
      return;
    }

    let request: IDBRequest<T>;
    try {
      request = operation(transaction.objectStore(store));
    } catch (error) {
      reject(new StorageUnavailableError(error instanceof Error ? error.message : 'Storage failed'));
      return;
    }

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(
        new StorageUnavailableError(request.error?.message ?? 'The local database rejected a write.'),
      );
    };
    transaction.onabort = () => {
      reject(
        new StorageUnavailableError(
          transaction.error?.message ?? 'The local database transaction was aborted.',
        ),
      );
    };
  });
}