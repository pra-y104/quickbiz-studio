/**
 * Service worker registration for offline support.
 *
 * Registers /sw.js which caches the app shell and ordinary tool pages so the
 * free client-side tools keep working when the network is unavailable.
 *
 * Honest limitation: this is a single-isolate service worker cache, not a
 * production-grade distributed cache. It works in the browser that installed
 * it.
 */

let registration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('[QuickBiz] Service worker registered', registration.scope);
  } catch {
    registration = null;
    // Service worker registration can fail in private mode, incognito, or when
    // the file is not served over HTTPS/localhost. Offline tools simply won't
    // work offline in those browsers.
  }
}

export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return registration;
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}
