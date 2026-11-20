import { describe, expect, it } from 'vitest';
import { runRequest } from '../idb';

interface FakeRequest<T> {
  result: T;
  error: DOMException | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface FakeTransaction {
  error: DOMException | null;
  oncomplete: (() => void) | null;
  onabort: (() => void) | null;
  onerror: (() => void) | null;
  objectStore: (name?: string) => FakeStore;
}

interface FakeStore {
  put: (value: unknown) => FakeRequest<IDBValidKey>;
  get: (key: unknown) => FakeRequest<unknown>;
  delete: (key: unknown) => FakeRequest<undefined>;
  getAll: () => FakeRequest<unknown[]>;
}

function createHarness() {
  const state = {
    transaction: null as FakeTransaction | null,
    store: null as FakeStore | null,
    request: null as FakeRequest<unknown> | null,
  };

  const database = {
    transaction(_store: string, _mode: IDBTransactionMode) {
      const store: FakeStore = {
        put: () => {
          const request: FakeRequest<IDBValidKey> = {
            result: 'key',
            error: null,
            onsuccess: null,
            onerror: null,
          };
          state.request = request;
          return request;
        },
        get: () => {
          const request: FakeRequest<unknown> = {
            result: { id: 'a' },
            error: null,
            onsuccess: null,
            onerror: null,
          };
          state.request = request;
          return request;
        },
        delete: () => {
          const request: FakeRequest<undefined> = {
            result: undefined,
            error: null,
            onsuccess: null,
            onerror: null,
          };
          state.request = request;
          return request;
        },
        getAll: () => {
          const request: FakeRequest<unknown[]> = {
            result: [],
            error: null,
            onsuccess: null,
            onerror: null,
          };
          state.request = request;
          return request;
        },
      };

      const transaction: FakeTransaction = {
        error: null,
        oncomplete: null,
        onabort: null,
        onerror: null,
        objectStore: () => store,
      };

      state.transaction = transaction;
      state.store = store;
      return transaction;
    },
  } as unknown as IDBDatabase;

  return { database, state };
}

function settle(task: Promise<unknown>): {
  status: () => 'pending' | 'fulfilled' | 'rejected';
  value: () => unknown;
} {
  let status: 'pending' | 'fulfilled' | 'rejected' = 'pending';
  let value: unknown;

  task.then(
    (result) => {
      status = 'fulfilled';
      value = result;
    },
    (error: unknown) => {
      status = 'rejected';
      value = error;
    },
  );

  return {
    status: () => status,
    value: () => value,
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('runRequest durability', () => {
  it('does not resolve a write when the request succeeds', async () => {
    const { database, state } = createHarness();

    const task = runRequest<IDBValidKey>({
      database,
      store: 'projects',
      mode: 'readwrite',
      operation: (store) => store.put({ id: 'a' }),
    });

    const outcome = settle(task);
    state.request?.onsuccess?.();
    await flush();

    expect(outcome.status()).toBe('pending');
  });

  it('resolves a write only after the transaction completes', async () => {
    const { database, state } = createHarness();

    const task = runRequest<IDBValidKey>({
      database,
      store: 'projects',
      mode: 'readwrite',
      operation: (store) => store.put({ id: 'a' }),
    });

    const outcome = settle(task);
    state.request?.onsuccess?.();
    state.transaction?.oncomplete?.();
    await flush();

    expect(outcome.status()).toBe('fulfilled');
    expect(outcome.value()).toBe('key');
  });

  it('rejects when the transaction aborts after the request succeeded', async () => {
    const { database, state } = createHarness();

    const task = runRequest<IDBValidKey>({
      database,
      store: 'projects',
      mode: 'readwrite',
      operation: (store) => store.put({ id: 'a' }),
    });

    const outcome = settle(task);
    state.request?.onsuccess?.();

    if (state.transaction) {
      state.transaction.error = new DOMException('Quota exceeded', 'QuotaExceededError');
    }
    state.transaction?.onabort?.();
    await flush();

    expect(outcome.status()).toBe('rejected');
    expect(String(outcome.value())).toContain('Quota exceeded');
  });

  it('rejects when the transaction errors after the request succeeded', async () => {
    const { database, state } = createHarness();

    const task = runRequest<IDBValidKey>({
      database,
      store: 'projects',
      mode: 'readwrite',
      operation: (store) => store.put({ id: 'a' }),
    });

    const outcome = settle(task);
    state.request?.onsuccess?.();
    state.transaction?.onerror?.();
    await flush();

    expect(outcome.status()).toBe('rejected');
  });

  it('resolves a read on request success without waiting for completion', async () => {
    const { database, state } = createHarness();

    const task = runRequest<unknown>({
      database,
      store: 'projects',
      mode: 'readonly',
      operation: (store) => store.get('a'),
    });

    const outcome = settle(task);
    state.request?.onsuccess?.();
    await flush();

    expect(outcome.status()).toBe('fulfilled');
  });

  it('ignores a late completion after an abort', async () => {
    const { database, state } = createHarness();

    const task = runRequest<IDBValidKey>({
      database,
      store: 'projects',
      mode: 'readwrite',
      operation: (store) => store.put({ id: 'a' }),
    });

    const outcome = settle(task);
    state.transaction?.onabort?.();
    state.transaction?.oncomplete?.();
    await flush();

    expect(outcome.status()).toBe('rejected');
  });

  it('rejects a request error', async () => {
    const { database, state } = createHarness();

    const task = runRequest<IDBValidKey>({
      database,
      store: 'projects',
      mode: 'readwrite',
      operation: (store) => store.put({ id: 'a' }),
    });

    const outcome = settle(task);
    state.request?.onerror?.();
    await flush();

    expect(outcome.status()).toBe('rejected');
  });
});
