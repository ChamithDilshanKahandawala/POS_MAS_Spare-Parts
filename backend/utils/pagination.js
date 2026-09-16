// Clamps a requested page-size query param into a safe range: falls back to
// `fallback` when missing/invalid, and caps anything above `max` down to it
// instead of erroring — so ?limit=999999999 can't force a full-collection dump.
function clampLimit(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

module.exports = { clampLimit };
