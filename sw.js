const VERSION = '1.0.2';
const CACHE_NAME = `noteepadd-cache-${VERSION}`;
const BASE_URL = '/Noteepadd';

const STATIC_CACHE_URLS = [
  `${BASE_URL}/`,
  `${BASE_URL}/index.html`,
  `${BASE_URL}/icon-192x192.png`,
  `${BASE_URL}/icon-512x512.png`,
  `${BASE_URL}/offline.html`,
  // Add other static resources
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith('noteepadd-cache-') && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Check if the request is for a page in our app
  if (request.url.startsWith(self.location.origin + BASE_URL)) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(
            fetchResponse => {
              if(!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                return fetchResponse;
              }
              const responseToCache = fetchResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, responseToCache));
              return fetchResponse;
            }
          );
        })
        .catch(() => {
          // Fallback to offline page if it's a navigation request
          if (request.mode === 'navigate') {
            return caches.match(`${BASE_URL}/offline.html`);
          }
        })
    );
  }
});

// Background Sync (if needed)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
});

async function syncNotes() {
  // Implement your sync logic here
  // Remember to use the correct API endpoint considering the GitHub Pages URL structure
}
