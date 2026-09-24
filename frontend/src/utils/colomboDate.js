// Mirrors backend/utils/colomboDate.js — Sri Lanka has no DST, so this
// fixed +05:30 offset is safe year-round.
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The calendar date a given instant falls on *in Asia/Colombo*, independent
// of the browser's own timezone/locale.
export function getColomboDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// The UTC instant corresponding to a given Colombo-local wall-clock time.
// month is 1-indexed; out-of-range month/day values normalize the same way
// the native Date constructor does (e.g. month 0 rolls back to December of
// the previous year), so callers can freely pass month +/- 1.
export function colomboDateToUTC(year, month, day, hour = 0, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - COLOMBO_OFFSET_MS);
}

const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DD" — the same bare-date shape a <input type="date"> picker
// sends, so the backend (getSales) resolves it as a Colombo calendar date
// rather than defaulting to a UTC one.
export function toColomboDateString(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// The Colombo calendar date (as "YYYY-MM-DD") that a given instant falls on.
export function getColomboDateString(date = new Date()) {
  const { year, month, day } = getColomboDateParts(date);
  return toColomboDateString(year, month, day);
}
