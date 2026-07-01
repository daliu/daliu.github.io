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
 * else in scope — notably the standalone HTML pages — is network-first with a
 * cache fallback, so edits reach returning users without a version bump while
 * they stay available offline. The cache name is VERSIONED — bumping
 * CACHE_VERSION on a content/corpus change forces a fresh precache, so a
 * mid-practice user's scenarios never silently change underneath them (the
 * versioning discipline runtime-architecture.md calls for).
 *
 * NOTE: the user's choices are NOT here — they live in IndexedDB via the engine.
 * This SW only caches static app assets; it touches no personal data.
 * ============================================================================ */

const CACHE_VERSION = "poc-app-v25-2026-07";
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

// Cache-first for the precached core (app shell + runtime + content bundle):
// stable offline, never blocks, and changes only on a deliberate CACHE_VERSION
// bump so a mid-practice user's scenarios never shift underneath them.
function cacheFirst(req) {
  return caches.match(req).then(hit => hit || fetch(req).then(resp => {
    if (resp && resp.ok && resp.type === "basic") caches.open(CACHE_VERSION).then(c => c.put(req, resp.clone()));
    return resp;
  }));
}
// Network-first for everything else in scope — notably the standalone HTML pages
// (landing, profile, onramp, the demos). Edits reach returning users immediately
// when online; the last-cached copy still serves them offline.
function networkFirst(req) {
  return fetch(req).then(resp => {
    if (resp && resp.ok && resp.type === "basic") caches.open(CACHE_VERSION).then(c => c.put(req, resp.clone()));
    return resp;
  }).catch(() => caches.match(req));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only handle in-scope, same-origin requests; let everything else (e.g. the
  // GA beacon) go straight to the network untouched.
  if (url.origin !== self.location.origin) return;
  const faviconPath = new URL("../favicon.svg", self.registration.scope).pathname;
  if (!url.pathname.startsWith(SCOPE_PREFIX) && url.pathname !== faviconPath) return;

  event.respondWith(PRECACHE.includes(url.pathname) ? cacheFirst(req) : networkFirst(req));
});
