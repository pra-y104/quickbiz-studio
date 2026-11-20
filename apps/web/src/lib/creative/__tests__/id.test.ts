import { describe, expect, it } from 'vitest';
import { createBrowserId } from '../id';

describe('createBrowserId', () => {
  it('returns a prefixed, filesystem-safe id', () => {
    const id = createBrowserId('doc');
    expect(id.startsWith('doc_')).toBe(true);
    expect(id).toMatch(/^[a-z]+_[A-Za-z0-9_-]+$/);
  });

  it('returns a different id on every call', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createBrowserId('doc')));
    expect(ids.size).toBe(200);
  });

  it('falls back when crypto.randomUUID is unavailable', () => {
    const original = (globalThis as { crypto?: unknown }).crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      const id = createBrowserId('doc');
      expect(id.startsWith('doc_')).toBe(true);
      expect(id.length).toBeGreaterThan('doc_'.length);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
