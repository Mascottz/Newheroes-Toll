/*
 * NEWHEROES Toll Gate — Service Worker
 * ------------------------------------
 * Strategy:
 *  - Precache the app shell (index.html, manifest, icons) at install.
 *  - Navigations: network-first, falling back to the cached shell (offline start).
 *  - Same-origin static assets (hashed /assets/*, icons): cache-first.
 *  - Everything else (Supabase API calls etc.) goes straight to the network —
 *    the app itself queues tickets offline and syncs them when back online.
 *
 * NOTE: bump CACHE_VERSION whenever you ship a breaking shell change.
 */
const CACHE_VERSION = 'v3';
const SHELL_CACHE = `nh-toll-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `nh-toll-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/brand/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // allSettled so a single missing asset never blocks installation
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('nh-toll-') && !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const isCacheableAsset = (pathname) =>
  pathname.startsWith('/assets/') ||
  pathname.startsWith('/icons/') ||
  pathname === '/manifest.webmanifest' ||
  pathname === '/favicon.svg';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API / third-party: network only

  // --- App navigations: network-first with cached-shell fallback ---
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put('/index.html', fresh.clone());
          return fresh;
        } catch (err) {
          const cached =
            (await caches.match('/index.html')) || (await caches.match(req));
          if (cached) return cached;
          return new Response(
            '<h1>Offline</h1><p>Open the app once while online to enable offline mode.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html' } }
          );
        }
      })()
    );
    return;
  }

  // --- Same-origin static assets: cache-first ---
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && isCacheableAsset(url.pathname)) {
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const shell = await caches.match('/index.html');
        if (shell) return shell;
        return Response.error();
      }
    })()
  );
});
