/* DabbyMarket service worker — offline app shell */
const VERSION = "dabby-v1";
const APP_SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const PRECACHE_URLS = ["/", "/carte", "/messages", "/compte", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL)
      .then((c) => Promise.allSettled(PRECACHE_URLS.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("dabby-") && !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // NetworkFirst for HTML navigations
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = (await caches.match(req)) || (await caches.match("/"));
          return (
            cached ||
            new Response("<h1>Hors connexion</h1><p>Reconnectez-vous pour continuer.</p>", {
              headers: { "Content-Type": "text/html; charset=utf-8" },
              status: 503,
            })
          );
        }
      })(),
    );
    return;
  }

  // CacheFirst for same-origin hashed assets
  if (/\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        });
      }),
    );
  }
});
