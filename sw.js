/* CompuLite CAD — service worker.
   Network-first for page navigations (always-fresh app, never a stale build),
   cache-first for hashed static assets (offline + speed). Enables PWA install. */
const CACHE = "compulite-v2";
// Works whether the app is served at the domain root ("/") or under a
// sub-path (e.g. GitHub Pages "/Polite24-CommandCenter/").
const BASE = self.location.pathname.replace(/sw\.js$/, "");

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(BASE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache API / auth / realtime / map-tile / external calls — always live.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/functions/")) return;

  // Page navigations: network-first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(BASE).then((m) => m || caches.match(req))));
    return;
  }

  // Same-origin static assets (hashed JS/CSS/img/fonts): cache-first.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
