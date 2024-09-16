const VERSION = '1.0.1';
const CACHE_NAME = `noteepadd-cache-${VERSION}`;
const REPO_NAME = 'Noteepadd'; // Replace with your actual repository name
const BASE_URL = `/${REPO_NAME}`; // Remove this line if it's a user or organization site

const STATIC_CACHE_URLS = [
  BASE_URL + '/',
  BASE_URL + '/index.html',
  BASE_URL + '/icon-192x192.png',
  BASE_URL + '/icon-512x512.png',
  BASE_URL + '/offline.html',
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
  
  // HTML files: Network-first strategy
  if (request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)
          .then(response => response || caches.match(BASE_URL + '/offline.html')))
    );
    return;
  }

  // Other files: Cache-first strategy
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
  );
});

// Background Sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
});

async function syncNotes() {
  const db = await openDB('NotePadDB', 1, {
    upgrade(db) {
      db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
    },
  });

  const tx = db.transaction('notes', 'readonly');
  const store = tx.objectStore('notes');
  const unsyncedNotes = await store.index('synced').getAll(0);

  for (const note of unsyncedNotes) {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
      note.synced = 1;
      await db.put('notes', note);
    } catch (error) {
      console.error('Sync failed for note:', note.id, error);
    }
  }
}
