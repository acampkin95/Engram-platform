const CACHE_NAME = 'engram-v1';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/dashboard/home',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
    }),
  );
  self.clients.claim();
});

// Fetch: Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests
  if (event.request.url.includes('/api/')) return;

  // Skip MCP requests
  if (event.request.url.includes('/mcp')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return (
        response ||
        fetch(event.request).then((fetchResponse) => {
          // Cache new static assets
          if (
            fetchResponse.ok &&
            event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)
          ) {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return fetchResponse;
        })
      );
    }),
  );
});
