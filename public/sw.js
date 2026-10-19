// public/sw.js

const CACHE_NAME = 'finance-erp-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Never cache Supabase API or auth traffic:
  // - API responses are user-scoped and would leak between sessions.
  // - Cached API data would short-circuit fresh pulls.
  try {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) {
      return;
    }
  } catch {
    // If URL parsing fails, fall through to normal handling.
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
