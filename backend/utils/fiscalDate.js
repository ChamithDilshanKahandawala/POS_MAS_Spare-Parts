const { getColomboDateParts, colomboDateToUTC } = require('./colomboDate');

function getFiscalMonthRange(referenceDate = new Date()) {
  const { year, month, day } = getColomboDateParts(referenceDate);

  // Fiscal month runs from the 11th through the 10th (Asia/Colombo local
  // time) so billing stays aligned with the business cycle.
  const start = day >= 11
    ? colomboDateToUTC(year, month, 11)
    : colomboDateToUTC(year, month - 1, 11);

  const end = day >= 11
    ? colomboDateToUTC(year, month + 1, 10, 23, 59, 59, 999)
    : colomboDateToUTC(year, month, 10, 23, 59, 59, 999);

  return { start, end };
}

module.exports = { getFiscalMonthRange };
