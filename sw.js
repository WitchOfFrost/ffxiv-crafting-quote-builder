/* Service worker: makes repeat visits load from disk instead of the network.
   GitHub Pages serves everything with Cache-Control: max-age=600 and offers no
   way to change that, so caching is handled here instead.

   Strategy:
     navigations  — network first, cache as fallback (so a deploy is picked up
                    immediately, and the app still opens offline)
     static files — stale-while-revalidate (instant, refreshed in the background)
     API traffic  — never touched; prices must always be live

   VERSION is stamped with the commit SHA by the deploy workflow, so every
   deploy gets a fresh cache and the old ones are dropped on activate. */

const VERSION = "__BUILD__";
const CACHE = `cqb-${VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./js/core.js",
  "./js/api.js",
  "./js/pricing.js",
  "./js/craftlist.js",
  "./js/quote.js",
  "./js/storage.js",
  "./js/export.js",
  "./js/app.js",
  "./assets/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // a single missing file must not fail the whole install
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // XIVAPI and Universalis stay on the network — cached prices would be wrong
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match("./index.html")),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
