// Tiny module-level pub-sub, not component state — the axios interceptor
// that detects a cache-served response (src/api/axios.js) lives outside
// any component tree, so there's nothing to lift this into. Tracks
// whether the *last* /api/products response actually came from the
// service worker's cache (the X-From-SW-Cache header src/sw.js's
// NetworkFirst plugin sets on its cache-fallback path) — distinct from
// navigator.onLine, which only tells you connectivity, not whether the
// prices/stock on screen are live or cached (see useOnlineStatus.js for
// that signal; OfflineBanner.jsx shows if either is true).
let isStale = false;
const listeners = new Set();

export function setStaleProductData(value) {
  if (isStale === value) return;
  isStale = value;
  listeners.forEach((listener) => listener(value));
}

export function getStaleProductData() {
  return isStale;
}

export function subscribeStaleProductData(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
