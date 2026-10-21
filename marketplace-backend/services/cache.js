// A tiny in-process cache for data that's read constantly but changes
// rarely (categories, vehicle makes) — every listing wizard step and
// every public catalog browse re-reads the same handful of documents.
// Not a general-purpose cache: it's deliberately small, in-memory only
// (no Redis — this app runs as one process), and every write path that
// touches a cached collection calls invalidate() for that key right
// after saving, rather than relying on the TTL alone to catch up.
// The TTL is just a safety net for a write path that forgets to
// invalidate, not the primary invalidation mechanism.
const DEFAULT_TTL_MS = 60 * 1000;

const store = new Map(); // key -> { value, expiresAt }

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Clears one exact key, or every key starting with a prefix (e.g.
// invalidate('category:') after any category write, regardless of which
// specific cached query it affects).
function invalidate(keyOrPrefix) {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyOrPrefix)) store.delete(key);
  }
}

function clear() {
  store.clear();
}

module.exports = { get, set, invalidate, clear };
