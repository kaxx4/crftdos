/* crftd Stall OS service worker.
 *
 * Deliberately hand-written and small rather than pulled from a plugin: the
 * caching rules here are load-bearing for correctness, not just speed, and
 * they need to be readable by whoever debugs a stall at 4pm with no signal.
 *
 * Three rules, in priority order:
 *
 *  1. NEVER cache /api/*. Stock counts, receipt blocks and shift state must
 *     never be served stale — a cached stock number causes an oversell, and a
 *     cached receipt block causes duplicate receipt numbers. API requests go
 *     to the network and fail honestly when offline; the outbox
 *     (src/lib/outbox.ts) is what makes that survivable.
 *
 *  2. Navigations: network-first with a cached shell fallback. Online you
 *     always get fresh HTML. Offline you get the last-seen shell instead of
 *     the browser's dinosaur, and the app boots from its IndexedDB catalogue
 *     cache (src/lib/catalogueCache.ts).
 *
 *  3. Static assets (/_next/static, fonts, images, mockups, cutouts):
 *     cache-first. These are content-hashed or stable, so a stale hit is
 *     always correct and always faster.
 */

const VERSION = "v1";
const SHELL_CACHE = `crftd-shell-${VERSION}`;
const ASSET_CACHE = `crftd-assets-${VERSION}`;

// Routes worth having available offline. Precached on install so a device
// that has been opened once on wifi can cold-start without signal.
const SHELL_ROUTES = ["/", "/orders", "/stock/products", "/stock/stickers", "/restock", "/more"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 cannot fail the whole install.
      .then((cache) => Promise.allSettled(SHELL_ROUTES.map((r) => cache.add(r))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("crftd-") && k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/mockups") ||
    url.pathname.startsWith("/fonts") ||
    /\.(svg|png|jpe?g|webp|gif|ico|woff2?|ttf|css|js)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // (1) Never cache the API. See header comment — this one is a correctness
  // rule, not a performance trade-off.
  if (url.pathname.startsWith("/api/")) return;

  // (2) Navigations: network first, cached shell as the offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("/") || Response.error())
        )
    );
    return;
  }

  // (3) Static assets: cache first, refill in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
  }
});
