// Copied from backend/utils/colomboDate.js (not imported across
// projects — marketplace-backend is a separate app). Sri Lanka has no
// DST, so this fixed +05:30 offset is safe year-round.
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The calendar date a given instant falls on *in Asia/Colombo*,
// independent of the server process's own timezone.
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
function colomboDateToUTC(year, month, day, hour = 0, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - COLOMBO_OFFSET_MS);
}

// Midnight (00:00:00.000) in Asia/Colombo for the calendar day the given
// instant falls on there.
function getColomboMidnightUTC(date = new Date()) {
  const { year, month, day } = getColomboDateParts(date);
  return colomboDateToUTC(year, month, day);
}

module.exports = { getColomboDateParts, colomboDateToUTC, getColomboMidnightUTC };
