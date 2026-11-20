import { describe, expect, it } from 'vitest';
import { canvasFromPreset, createCreativeDocument, requirePreset } from '@quickbiz/shared';
import {
  collectReferencedAssetIds,
  createInMemoryProjectStore,
  deleteProjectWithAssets,
  type CreativeProjectRecord,
} from '../project-store';
import { createInMemoryAssetStore as createAssets, type StoredAsset } from '../asset-store';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function asset(id: string): StoredAsset {
  return {
    id,
    name: id,
    mimeType: 'image/png',
    bytes: new Uint8Array([1, 2, 3]).buffer,
    width: 10,
    height: 10,
    createdAt: NOW.toISOString(),
  };
}

function record(id: string, assetIds: readonly string[]): CreativeProjectRecord {
  const base = createCreativeDocument({
    title: id,
    canvas: canvasFromPreset(requirePreset('social-square')),
    now: NOW,
  });

  return {
    id,
    title: id,
    document: {
      ...base,
      nodes: assetIds.map((assetId, index) => ({
        id: `n${index}`,
        type: 'image' as const,
        name: assetId,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        assetId,
        fit: 'cover' as const,
        crop: { x: 0, y: 0, width: 1, height: 1 },
      })),
    },
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

describe('project deletion and asset garbage collection', () => {
  it('collects only the assets still referenced', async () => {
    const store = createInMemoryProjectStore([
      record('a', ['a1', 'shared']),
      record('b', ['shared']),
    ]);
    expect(await collectReferencedAssetIds(store)).toEqual(new Set(['a1', 'shared']));
  });

  it('removes assets that no project references any more', async () => {
    const projects = createInMemoryProjectStore([
      record('a', ['a1', 'shared']),
      record('b', ['shared']),
    ]);
    const assets = createAssets([asset('a1'), asset('shared')]);

    const result = await deleteProjectWithAssets(projects, assets, 'a');

    expect(result.removedAssets).toBe(1);
    expect(await assets.get('a1')).toBeNull();
    expect(await assets.get('shared')).not.toBeNull();
  });

  it('keeps every asset when another project still uses it', async () => {
    const projects = createInMemoryProjectStore([record('a', ['shared']), record('b', ['shared'])]);
    const assets = createAssets([asset('shared')]);

    const result = await deleteProjectWithAssets(projects, assets, 'a');

    expect(result.removedAssets).toBe(0);
    expect(await assets.get('shared')).not.toBeNull();
  });

  it('removes all assets when the last project is deleted', async () => {
    const projects = createInMemoryProjectStore([record('a', ['a1'])]);
    const assets = createAssets([asset('a1')]);

    const result = await deleteProjectWithAssets(projects, assets, 'a');

    expect(result.removedAssets).toBe(1);
    expect(await projects.list()).toHaveLength(0);
  });

  it('is a no-op for an unknown project id', async () => {
    const projects = createInMemoryProjectStore([record('a', ['a1'])]);
    const assets = createAssets([asset('a1')]);

    const result = await deleteProjectWithAssets(projects, assets, 'missing');

    expect(result.removedAssets).toBe(0);
    expect(await assets.get('a1')).not.toBeNull();
  });
});
