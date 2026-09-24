import { getColomboDateParts, colomboDateToUTC, toColomboDateString } from './colomboDate';

// Fiscal month runs from the 11th through the 10th (Asia/Colombo local
// time) so billing stays aligned with the business cycle. Returned as bare
// "YYYY-MM-DD" strings — the same shape a <input type="date"> picker sends
// — so the backend (getSales) resolves them as Colombo calendar dates
// instead of raw UTC instants.
export function getFiscalMonthRange(referenceDate = new Date()) {
  const { year, month, day } = getColomboDateParts(referenceDate);

  const startUTC = day >= 11
    ? colomboDateToUTC(year, month, 11)
    : colomboDateToUTC(year, month - 1, 11);

  const endUTC = day >= 11
    ? colomboDateToUTC(year, month + 1, 10)
    : colomboDateToUTC(year, month, 10);

  // colomboDateToUTC already normalized any month/year rollover (e.g. month
  // 0 -> December of the previous year) — read the resulting calendar date
  // back out the same Colombo-aware way, rather than re-deriving it by hand.
  const startParts = getColomboDateParts(startUTC);
  const endParts = getColomboDateParts(endUTC);

  return {
    start: toColomboDateString(startParts.year, startParts.month, startParts.day),
    end: toColomboDateString(endParts.year, endParts.month, endParts.day),
  };
}
