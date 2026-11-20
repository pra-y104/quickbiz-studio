import { useEffect, useMemo, useState } from 'react';
import type { CreativeDocument } from '@quickbiz/shared';
import { getAssetStore } from '../storage';
import { collectAssetIds, loadAssets, type LoadedAsset } from '../render/asset-images';

/**
 * Load the images a document references.
 *
 * Re-runs only when the set of asset ids changes, so typing text or dragging a
 * shape never re-reads blobs from IndexedDB. Failures resolve to an empty map and
 * the renderer draws a placeholder, which keeps one missing asset from breaking
 * the whole design.
 */
export function useAssetImages(document: CreativeDocument): ReadonlyMap<string, LoadedAsset> {
  const ids = useMemo(() => collectAssetIds(document), [document]);
  const key = ids.join('|');

  const [loaded, setLoaded] = useState<{ key: string; map: Map<string, LoadedAsset> }>(() => ({
    key: '',
    map: new Map(),
  }));

  const empty = useMemo(() => new Map<string, LoadedAsset>(), []);

  useEffect(() => {
    let cancelled = false;

    if (ids.length === 0) return;

    loadAssets(getAssetStore(), ids)
      .then((result) => {
        if (!cancelled) setLoaded({ key, map: result });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, map: new Map() });
      });

    return () => {
      cancelled = true;
    };
    // `ids` is derived from `key`, so keying on the string is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return loaded.key === key ? loaded.map : empty;
}
