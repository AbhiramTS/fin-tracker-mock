// FinTracker Service Worker
// Cache-first strategy for all GET requests
// Offline-capable: app shell cached on install

const CACHE_NAME = "fintracker-v4";
const ROOT_URL = new URL("./", self.registration.scope).pathname;
const INDEX_URL = new URL("index.html", self.registration.scope).pathname;
const PRECACHE_URLS = [ROOT_URL, INDEX_URL];

// Install: precache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first, falling back to network, then cached fallback
self.addEventListener("fetch", (event) => {
  // Skip non-GET and cross-origin requests (e.g. Firebase)
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Keep installability metadata fresh; avoid caching manifest/SW files.
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.endsWith("manifest.json")) return;
  if (requestUrl.pathname.endsWith("sw.js")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response.ok) return response;
          // Cache fresh responses
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Fallback to index.html for navigation requests (SPA routing)
          if (event.request.mode === "navigate") {
            return caches.match(INDEX_URL);
          }
        });
    })
  );
});
