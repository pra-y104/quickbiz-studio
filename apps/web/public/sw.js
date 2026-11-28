/* global self, caches, fetch, URL */
/**
 * QuickBiz Studio service worker.
 *
 * Caches the app shell and ordinary tool pages so the free, client-side tools
 * (calculator, word counter, percentage, unit converter, date calculator,
 * text formatter, invoice maker, quotation maker) keep working when the
 * network is unavailable.
 *
 * Strategy:
 *  * Cache-first for static assets (JS, CSS, favicon) — they are versioned by
 *    the build and never change within a deployment.
 *  * Network-first for HTML navigations, falling back to index.html so client
 *    side routing works offline.
 *  * Network-only for API calls — AI, wallet and payments always fail closed
 *    when offline; they are never cached.
 *
 * Honest limitation: this is a single-isolate service worker cache. It is not
 * a production-grade distributed cache. It exists so ordinary tools work
 * offline in the browser that installed it.
 */

const CACHE_NAME = 'quickbiz-v2';
// Only truly static, content-hashed assets belong in the cache-first shell.
// The HTML document ('/') is intentionally EXCLUDED: navigations must always be
// revalidated against the network so a new deployment's index.html (and its new
// bundle hashes) reaches returning visitors instead of a stale cached shell.
const APP_SHELL = ['/favicon.svg', '/theme-init.js'];

// Ordinary tool routes that are fully client-side and work offline.
const OFFLINE_TOOLS = [
  '/tools',
  '/tools/calculator',
  '/tools/percentage-calculator',
  '/tools/unit-converter',
  '/tools/date-calculator',
  '/tools/word-counter',
  '/tools/text-formatter',
  '/tools/invoice-maker',
  '/tools/quotation-maker',
];

// Routes that must never be served from cache (auth, AI, wallet, payments).
const NO_CACHE_ROUTES = ['/api/', '/auth'];

/** Should this request be served from cache only? */
function isCacheable(url) {
  if (NO_CACHE_ROUTES.some((prefix) => url.pathname.startsWith(prefix))) {
    return false;
  }
  // Static assets are cacheable.
  if (url.pathname.startsWith('/assets/')) return true;
  // App shell and tool routes are cacheable.
  if (APP_SHELL.includes(url.pathname)) return true;
  if (OFFLINE_TOOLS.includes(url.pathname)) return true;
  return false;
}

self.addEventListener('install', (event) => {
  // Pre-cache the static shell. The HTML document is fetched at runtime and
  // cached on first navigation (network-first) so it is never stale.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // API and auth routes: network only, never cache.
  if (NO_CACHE_ROUTES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigations: ALWAYS network-first so a new deployment's index.html and
  // its new bundle hashes reach returning visitors. Only fall back to the cached
  // shell when the network is unavailable (offline). This must run before the
  // cache-first asset branch, otherwise '/' would be served stale forever.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (isCacheable(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Everything else: try cache, then network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request);
    }),
  );
});
