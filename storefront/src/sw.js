import { precacheAndRoute, createHandlerBoundToURL, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Hand-written (injectManifest mode, not generateSW) specifically because
// marking a cache-served response below needs a real plugin callback —
// generateSW only supports a fixed set of known, serializable plugin
// shapes (expiration, cacheableResponse, etc.), not arbitrary functions.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// registerType: 'prompt' in vite.config.js means the client never calls
// skipWaiting() on its own — only UpdatePrompt.jsx does, once the visitor
// clicks "Refresh". This is what actually carries that out in the SW.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Google Fonts stylesheet — small, changes rarely; revalidate in the
// background rather than cache-first.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
);

// The font files themselves are genuinely immutable (content-hashed URLs).
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Marks any response NetworkFirst actually served from cache (i.e. the
// live network request failed) with a header the app's axios layer reads
// to show the "stale data" banner — this is the only reason this is
// hand-written: generateSW's declarative config has no hook for a custom
// plugin callback like this.
const markServedFromCache = {
  cachedResponseWillBeUsed: async ({ cachedResponse }) => {
    if (!cachedResponse) return cachedResponse;
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-From-SW-Cache', '1');
    const body = await cachedResponse.clone().arrayBuffer();
    return new Response(body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  },
};

// Product/category data — the one thing worth ever serving stale. No
// networkTimeoutSeconds on purpose: a live request, however slow, always
// wins as long as it eventually succeeds, so a visitor on a slow-but-
// working connection gets real (if slow) prices/stock, never silently
// stale ones — the cache is a fallback for when the network request
// genuinely fails (true offline, DNS failure, etc.), not a race against
// a clock. GET-only (the 3rd arg) — this can't accidentally start caching
// a POST order.
registerRoute(
  /\/api\/products.*/,
  new NetworkFirst({
    cacheName: 'api-products-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      markServedFromCache,
    ],
  }),
  'GET'
);

// Everything else — /api/auth*, /api/sales*, Socket.IO, and any non-GET
// request — has no matching route below this point, on purpose. No route
// means the SW never intercepts it at all: the browser's normal network
// stack handles it exactly as if there were no service worker, so login,
// checkout, and order placement can never be silently answered from cache.

// SPA routing — any navigation that isn't itself a precached URL (e.g.
// /product/:id, /about) falls back to the precached app shell, which is
// what makes client-side routing work under the SW at all (online or
// offline). /api/ is denylisted so a failed API call is never redirected
// here instead of surfacing its own error.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//],
}));
