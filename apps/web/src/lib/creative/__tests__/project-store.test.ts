import { describe, expect, it } from 'vitest';
import { canvasFromPreset, createCreativeDocument, requirePreset } from '@quickbiz/shared';
import { createInMemoryProjectStore, type CreativeProjectRecord } from '../storage/project-store';
import { createInMemoryAssetStore } from '../storage/asset-store';

function record(id: string, title: string, updatedAt: string): CreativeProjectRecord {
  return {
    id,
    title,
    document: createCreativeDocument({
      title,
      canvas: canvasFromPreset(requirePreset('social-square')),
      now: new Date(updatedAt),
    }),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
  };
}

describe('in-memory project store', () => {
  it('lists projects newest first', async () => {
    const store = createInMemoryProjectStore([
      record('a', 'Older', '2026-01-01T00:00:00.000Z'),
      record('b', 'Newer', '2026-02-01T00:00:00.000Z'),
    ]);

    const list = await store.list();
    expect(list.map((project) => project.title)).toEqual(['Newer', 'Older']);
  });

  it('summarises canvas size and element count', async () => {
    const store = createInMemoryProjectStore([record('a', 'Design', '2026-01-01T00:00:00.000Z')]);
    const [summary] = await store.list();

    expect(summary?.presetLabel).toBe('1080 × 1080 px');
    expect(summary?.nodeCount).toBe(0);
  });

  it('returns a record by id and null when missing', async () => {
    const store = createInMemoryProjectStore([record('a', 'Design', '2026-01-01T00:00:00.000Z')]);

    expect((await store.get('a'))?.title).toBe('Design');
    expect(await store.get('missing')).toBeNull();
  });

  it('replaces an existing record with the same id', async () => {
    const store = createInMemoryProjectStore([record('a', 'First', '2026-01-01T00:00:00.000Z')]);
    await store.put(record('a', 'Renamed', '2026-03-01T00:00:00.000Z'));

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Renamed');
  });

  it('deletes a record and ignores unknown ids', async () => {
    const store = createInMemoryProjectStore([record('a', 'Design', '2026-01-01T00:00:00.000Z')]);

    await store.remove('a');
    await store.remove('missing');

    expect(await store.list()).toHaveLength(0);
  });

  it('reports that it is not persistent', () => {
    expect(createInMemoryProjectStore().persistent).toBe(false);
  });
});

describe('in-memory asset store', () => {
  it('stores, reads and removes assets', async () => {
    const store = createInMemoryAssetStore();
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    await store.put({
      id: 'a1',
      name: 'Logo',
      mimeType: 'image/png',
      bytes,
      width: 10,
      height: 10,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect((await store.get('a1'))?.name).toBe('Logo');
    expect(await store.get('missing')).toBeNull();

    await store.remove('a1');
    expect(await store.get('a1')).toBeNull();
  });
});
