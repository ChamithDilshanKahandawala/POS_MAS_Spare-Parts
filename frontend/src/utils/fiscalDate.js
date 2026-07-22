export function getFiscalMonthRange(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  // Fiscal month runs from the 11th through the 10th so billing stays aligned with the business cycle.
  const start = day >= 11
    ? new Date(year, month, 11)
    : new Date(year, month - 1, 11);

  const end = day >= 11
    ? new Date(year, month + 1, 10, 23, 59, 59, 999)
    : new Date(year, month, 10, 23, 59, 59, 999);

  return { start, end };
}