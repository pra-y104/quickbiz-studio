/**
 * Minimal promise wrapper over IndexedDB.
 *
 * The editor stores potentially large design documents, so localStorage is not
 * appropriate. Every call rejects with a readable error rather than hanging, and
 * `isIndexedDbAvailable()` lets the app decide whether to warn the customer that
 * their work will only last for this tab.
 *
 * Durability rule: a **write** is only reported as successful once the
 * transaction has committed. Resolving on `request.onsuccess` is wrong, because a
 * request can succeed and the transaction can still abort (quota, blocked,
 * version change) — reporting "saved" then loses the customer's work silently.
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

export interface RunRequestOptions<T> {
  readonly database: IDBDatabase;
  readonly store: string;
  readonly mode: IDBTransactionMode;
  readonly operation: (store: IDBObjectStore) => IDBRequest<T>;
}

function asStorageError(error: unknown, fallback: string): StorageUnavailableError {
  if (error instanceof StorageUnavailableError) return error;

  // DOMException does not extend Error in every environment, so read the message
  // structurally rather than relying on instanceof.
  const message =
    typeof (error as { message?: unknown } | null)?.message === 'string'
      ? (error as { message: string }).message
      : '';

  if (message.length > 0) return new StorageUnavailableError(message);
  return new StorageUnavailableError(fallback);
}

/**
 * Run one request and settle only when the transaction has finished.
 *
 * - `readwrite` transactions resolve on `oncomplete`, so a rolled-back write is
 *   reported as a failure and never as success.
 * - `readonly` transactions resolve on `request.onsuccess`, which is enough for a
 *   read whose result is already in hand.
 * - Aborts, quota errors and blocked upgrades all reject with a readable message.
 */
export function runRequest<T>(options: RunRequestOptions<T>): Promise<T> {
  const { database, store, mode, operation } = options;

  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(store, mode);
    } catch (error) {
      reject(asStorageError(error, 'Storage failed'));
      return;
    }

    let request: IDBRequest<T>;
    try {
      request = operation(transaction.objectStore(store));
    } catch (error) {
      reject(asStorageError(error, 'Storage failed'));
      return;
    }

    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };

    const fail = (error: unknown) => {
      settle(() => reject(asStorageError(error, 'The local database rejected a change.')));
    };

    request.onsuccess = () => {
      if (mode === 'readwrite') return;
      settle(() => resolve(request.result));
    };

    request.onerror = () => {
      fail(request.error ?? new Error('The local database rejected a change.'));
    };

    transaction.oncomplete = () => {
      if (mode === 'readwrite') settle(() => resolve(request.result));
    };

    transaction.onabort = () => {
      fail(transaction.error ?? new Error('The local database transaction was aborted.'));
    };

    transaction.onerror = () => {
      fail(transaction.error ?? new Error('The local database transaction failed.'));
    };
  });
}

/** True when the current page is being hidden or closed, so a save can flush. */
export function isPageLosingFocus(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden';
}
