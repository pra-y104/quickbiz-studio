/**
 * Service-worker registration.
 *
 * Kept out of the entry point so it can be tested without a browser worker, and so
 * the rules are explicit:
 *
 * - only in a production build (`import.meta.env.PROD`), so Vite's dev server and
 *   hot reload are never intercepted;
 * - only in a secure context with service-worker support;
 * - registration failure is silent: the app is fully usable without offline mode.
 */

export interface ServiceWorkerRegistrar {
  register(scriptUrl: string): Promise<unknown>;
}

export function canUseServiceWorker(
  workerApi: ServiceWorkerRegistrar | undefined,
  isSecure: boolean,
): boolean {
  return Boolean(workerApi) && isSecure;
}

/**
 * Register the worker and report whether it is active.
 *
 * Resolves `false` when registration is not attempted or fails, so callers never
 * need a try/catch around start-up.
 */
export async function registerServiceWorker(
  workerApi: ServiceWorkerRegistrar | undefined,
  isSecure: boolean,
  scriptUrl = '/sw.js',
): Promise<boolean> {
  if (!workerApi || !canUseServiceWorker(workerApi, isSecure)) return false;

  try {
    await workerApi.register(scriptUrl);
    return true;
  } catch {
    return false;
  }
}
