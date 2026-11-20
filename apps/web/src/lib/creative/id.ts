/**
 * Identifier generation.
 *
 * `crypto.randomUUID` is only available in secure contexts, so the editor must not
 * depend on it: a project opened over plain HTTP would otherwise fail to duplicate
 * or import. The fallback is time plus a counter, which is unique within a tab and
 * collisions across tabs are vanishingly unlikely for local project ids.
 */

let counter = 0;

export function createBrowserId(prefix = 'id'): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}_${cryptoApi.randomUUID()}`;
  }

  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
}
