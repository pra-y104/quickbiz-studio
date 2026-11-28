import { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { getAdminIdentity } from './client';

/**
 * Whether the signed-in account is an administrator, as decided by the server.
 *
 * The answer comes from `GET /api/v1/admin/me`: 200 means the token's account is
 * on the admin allow-list, 403 means it is not. The result is cached per user id
 * for the lifetime of the tab so ordinary pages do not repeat the call. Any
 * other outcome (401, network) is treated as "not admin" — the navigation entry
 * stays hidden and the server remains the real boundary.
 */
export type AdminStatus = 'checking' | 'admin' | 'user';

const cache = new Map<string, boolean>();

export function useIsAdmin(): AdminStatus {
  const { status, session, gateway } = useAuth();
  const userId = session?.user.id ?? null;
  // `result` holds only the asynchronous answer; synchronous branches are
  // derived at render time so the effect never calls setState directly.
  const [result, setResult] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== 'ready' || !userId) return;
    // Cached answers are derived from `cache` at render time; no state update.
    if (cache.has(userId)) return;

    let active = true;
    void (async () => {
      let isAdmin = false;
      try {
        const token = await gateway.getAccessToken();
        if (token) {
          await getAdminIdentity(token);
          isAdmin = true;
        }
      } catch {
        // 403 (and any other failure) => not an admin; never surface the link.
        isAdmin = false;
      }
      cache.set(userId, isAdmin);
      if (active) setResult(isAdmin);
    })();

    return () => {
      active = false;
    };
  }, [gateway, status, userId]);

  if (status !== 'ready' || !userId) return 'user';
  const cached = cache.get(userId);
  if (cached !== undefined) return cached ? 'admin' : 'user';
  return result === null ? 'checking' : result ? 'admin' : 'user';
}

/** Test seam: clear the per-user cache. */
export function clearAdminStatusCache(): void {
  cache.clear();
}
