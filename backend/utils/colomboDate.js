// Sri Lanka has no DST, so this fixed +05:30 offset is safe year-round —
// unlike a naive Date-diffing approach, it never needs to special-case a
// DST transition.
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The calendar date a given instant falls on *in Asia/Colombo*, independent
// of the server process's own timezone (Railway runs its containers in UTC).
function getColomboDateParts(date = new Date()) {
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
function colomboDateToUTC(year, month, day, hour = 0, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - COLOMBO_OFFSET_MS);
}

// Midnight (00:00:00.000) in Asia/Colombo for the calendar day the given
// instant falls on there.
function getColomboMidnightUTC(date = new Date()) {
  const { year, month, day } = getColomboDateParts(date);
  return colomboDateToUTC(year, month, day);
}

const BARE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parses a date-range boundary the way getSales' from/to query params need:
// a bare "YYYY-MM-DD" (e.g. from a <input type="date"> picker, or a preset
// period computed client-side) is a Colombo calendar date, not a UTC
// instant — resolve it as Colombo midnight rather than the UTC midnight
// `new Date(...)` would default to. Anything else (already a precise ISO
// instant) passes through unchanged.
function parseAsColomboRangeStart(value) {
  if (typeof value === 'string' && BARE_DATE_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return colomboDateToUTC(year, month, day);
  }
  return new Date(value);
}

// Same, but for a range's end — a bare date widens to the last instant of
// that Colombo calendar day instead of its midnight.
function parseAsColomboRangeEnd(value) {
  if (typeof value === 'string' && BARE_DATE_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return colomboDateToUTC(year, month, day, 23, 59, 59, 999);
  }
  return new Date(value);
}

module.exports = {
  getColomboDateParts,
  colomboDateToUTC,
  getColomboMidnightUTC,
  parseAsColomboRangeStart,
  parseAsColomboRangeEnd,
};
