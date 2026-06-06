/* ============================================================================
 * Patterns of Choice — service worker (offline-first precache)
 *
 * Makes the local-first practice installable and fully usable offline — which a
 * multi-week daily instrument genuinely needs (works with no connectivity, can
 * be added to the home screen). Scope is the /patterns-of-choice/ path only;
 * it does not control the rest of daliu.github.io.
 *
 * Cache strategy: cache-first for the precached app shell + runtime + content
 * bundle (so a session works with zero network and never blocks); everything
 * else falls through to the network. The cache name is VERSIONED — bumping
 * CACHE_VERSION on a content/corpus change forces a fresh precache, so a
 * mid-practice user's scenarios never silently change underneath them (the
 * versioning discipline runtime-architecture.md calls for).
 *
 * NOTE: the user's choices are NOT here — they live in IndexedDB via the engine.
 * This SW only caches static app assets; it touches no personal data.
 * ============================================================================ */

const CACHE_VERSION = "poc-app-v5-2026-06";
const SCOPE_PREFIX = "/patterns-of-choice/";

// Exact assets the app needs to run offline (relative to scope).
const PRECACHE = [
  "app.html",
  "runtime/poc-runtime.js",
  "runtime/poc-projection.js",
  "runtime/content-bundle.v0.1.json",
  "runtime/tag-axis-map.v0.1.json",
  "manifest.webmanifest",
  "../favicon.svg",
].map(p => new URL(p, self.registration.scope).pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only handle in-scope, same-origin requests; let everything else (e.g. the
  // GA beacon) go straight to the network untouched.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PREFIX) && url.pathname !== new URL("../favicon.svg", self.registration.scope).pathname) return;

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(resp => {
        // opportunistically cache successful in-scope GETs for next time
        if (resp && resp.ok && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => hit); // offline + uncached -> undefined (browser shows its offline UI)
    })
  );
});
