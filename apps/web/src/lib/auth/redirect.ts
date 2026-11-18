/** Guest-only routes: returning to them after sign-in would bounce or loop. */
const GUEST_PATH = /^\/(login|register|forgot-password)(?:[?#]|$)/;

/**
 * Only allow redirects back to this application.
 *
 * Rejects absolute URLs, protocol-relative URLs (`//evil.example`), backslash
 * tricks (`/\evil.example`) and anything that is not a plain path.
 */
export function safeNextPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return fallback;
  for (const character of trimmed) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(trimmed)) return fallback;
  if (GUEST_PATH.test(trimmed)) return fallback;
  return trimmed;
}

/** Current in-app path, used as the `next` parameter for sign-in. */
export function currentPathWithSearch(location: {
  readonly pathname: string;
  readonly search: string;
}): string {
  const path = `${location.pathname}${location.search}`;
  return path === '/' ? '/dashboard' : path;
}
