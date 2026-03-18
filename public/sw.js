// FinTracker Service Worker
// Strategy:
//   - HTML navigation requests  → Network first, fall back to cache
//   - Vite-fingerprinted assets → Cache first (URLs are content-hashed, safe forever)
//   - API / external            → Network only (skip SW)
//
// Cache name includes a build stamp so old caches are always evicted on update.
// The stamp is injected by the build (or defaults to the SW install time).

const CACHE_VERSION = '__CACHE_VERSION__'; // replaced at build time by vite.config.ts
const CACHE = `fintracker-${CACHE_VERSION}`;
const OFFLINE_PAGE = './index.html';

// Assets Vite fingerprints — safe to cache forever
const isFingerprinted = (url) =>
	/\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg|ico)(\?.*)?$/.test(url);

// Navigation requests (HTML pages)
const isNavigation = (req) => req.mode === 'navigate';

// ── Install: precache the shell ───────────────────────────────────────────────
self.addEventListener('install', (e) => {
	e.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll([OFFLINE_PAGE]))
			.then(() => self.skipWaiting()) // activate immediately, don't wait for old SW to die
	);
});

// ── Activate: delete every old cache ─────────────────────────────────────────
self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k !== CACHE)
						.map((k) => {
							console.info('[SW] deleting old cache:', k);
							return caches.delete(k);
						})
				)
			)
			.then(() => self.clients.claim()) // take control of all open tabs immediately
	);
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
	const { request } = e;

	// Only handle same-origin GET requests
	if (request.method !== 'GET') return;
	if (!request.url.startsWith(self.location.origin)) return;

	if (isNavigation(request)) {
		// Network-first: always try to get the freshest HTML shell
		e.respondWith(
			fetch(request)
				.then((res) => {
					if (res.ok) {
						const clone = res.clone();
						caches.open(CACHE).then((c) => c.put(request, clone));
					}
					return res;
				})
				.catch(() => caches.match(OFFLINE_PAGE))
		);
		return;
	}

	if (isFingerprinted(request.url)) {
		// Cache-first: content-hashed URLs are immutable
		e.respondWith(
			caches.match(request).then((cached) => {
				if (cached) return cached;
				return fetch(request).then((res) => {
					if (res.ok) {
						const clone = res.clone();
						caches.open(CACHE).then((c) => c.put(request, clone));
					}
					return res;
				});
			})
		);
		return;
	}

	// Everything else: network with cache fallback
	e.respondWith(
		fetch(request)
			.then((res) => {
				if (res.ok) {
					const clone = res.clone();
					caches.open(CACHE).then((c) => c.put(request, clone));
				}
				return res;
			})
			.catch(() => caches.match(request))
	);
});

// ── Message: allow clients to trigger skipWaiting manually ───────────────────
self.addEventListener('message', (e) => {
	if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
