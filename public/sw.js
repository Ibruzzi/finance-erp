// public/sw.js

const CACHE_NAME = 'finance-erp-v1';

// When the app installs, cache the essential shell
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

// When the app activates, clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy: Network First, fallback to cache
self.addEventListener('fetch', (event) => {
  // Don't intercept API calls or non-GET requests if you add them later
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the network request is successful, clone it and store it in the cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If the network fails (offline), try to serve the cached version
        return caches.match(event.request);
      })
  );
});
