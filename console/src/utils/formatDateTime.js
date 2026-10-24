// Follow-up — every comparison that decides WHEN something happens
// (the POS-not-recorded reminder's 24h/daily thresholds, auto-cancel,
// etc.) runs entirely in the backend on plain epoch milliseconds, which
// is already timezone-agnostic — a JS/BSON Date has no timezone of its
// own. The one place a timezone actually matters is here: DISPLAYING a
// timestamp to a seller or admin should read in Sri Lanka's own time
// (Asia/Colombo), not whatever the viewer's browser/OS happens to be set
// to (a seller's laptop misconfigured to UTC, or an admin traveling,
// would otherwise see a different, wrong hour for the same instant).
const TIME_ZONE = 'Asia/Colombo';

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-LK', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-LK', { timeZone: TIME_ZONE });
}
