// Service Worker for Das Kapital Chapter Explanations (PWA & Offline Support)
const CACHE_NAME = 'kapital-cache-v10';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/reader.css',
  './assets/reader.js',
  './assets/palette.css',
  './assets/palette-data.js',
  './assets/palette-engine.js',
  './assets/vendor/pretext.min.js',
  './assets/vendor/katex.min.css',
  './assets/vendor/katex.min.js',
  './assets/vendor/auto-render.min.js',
  './assets/vendor/marked.min.js',
  './assets/vendor/fonts/KaTeX_AMS-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Caligraphic-Bold.woff2',
  './assets/vendor/fonts/KaTeX_Caligraphic-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Fraktur-Bold.woff2',
  './assets/vendor/fonts/KaTeX_Fraktur-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Main-Bold.woff2',
  './assets/vendor/fonts/KaTeX_Main-BoldItalic.woff2',
  './assets/vendor/fonts/KaTeX_Main-Italic.woff2',
  './assets/vendor/fonts/KaTeX_Main-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Math-BoldItalic.woff2',
  './assets/vendor/fonts/KaTeX_Math-Italic.woff2',
  './assets/vendor/fonts/KaTeX_SansSerif-Bold.woff2',
  './assets/vendor/fonts/KaTeX_SansSerif-Italic.woff2',
  './assets/vendor/fonts/KaTeX_SansSerif-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Script-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Size1-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Size2-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Size3-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Size4-Regular.woff2',
  './assets/vendor/fonts/KaTeX_Typewriter-Regular.woff2',
  './search-worker.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Handle local file / same-origin requests
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background for non-vendor files
        if (!request.url.includes('/assets/vendor/')) {
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {/* offline fallback */});
        }
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache visited chapters / data
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If offline and request is for an HTML page, return index if cached
        if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
