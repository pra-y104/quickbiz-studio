import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the stale-homepage bug.
 *
 * The service worker must never serve the HTML document ('/') from a
 * cache-first branch: doing so traps returning visitors on an old cached
 * index.html (and its old bundle hashes) after a new deployment. Navigations
 * must be network-first, and the cache name must be versioned so an upgrade
 * purges the previous shell.
 */
const swSource = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

describe('service worker (public/sw.js)', () => {
  it('does not include the HTML document in the cache-first app shell', () => {
    // The APP_SHELL array must not contain a bare '/' entry.
    const appShellMatch = swSource.match(/const APP_SHELL = \[([^\]]*)\]/);
    expect(appShellMatch).not.toBeNull();
    const entries = appShellMatch![1]!.split(',').map((entry) => entry.trim());
    expect(entries).not.toContain("'/'");
  });

  it('handles navigations network-first before the cache-first asset branch', () => {
    const navigateIndex = swSource.indexOf("request.mode === 'navigate'");
    const cacheableIndex = swSource.indexOf('if (isCacheable(url))');
    expect(navigateIndex).toBeGreaterThan(-1);
    expect(cacheableIndex).toBeGreaterThan(-1);
    // The navigate (network-first) branch must come first.
    expect(navigateIndex).toBeLessThan(cacheableIndex);
  });

  it('uses a versioned cache name so upgrades purge the old shell', () => {
    expect(swSource).toMatch(/const CACHE_NAME = 'quickbiz-v\d+'/);
    expect(swSource).toContain('keys.filter((key) => key !== CACHE_NAME)');
  });
});
