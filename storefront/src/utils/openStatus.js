// Whether the shop is open right now, evaluated in Asia/Colombo local time
// regardless of the visitor's own device timezone. `hours` is SHOP_INFO.hours
// ({ open: 'HH:MM', close: 'HH:MM' }); `now` defaults to the real clock but
// is an explicit parameter so it can be mocked in tests without touching
// global Date. Open/close are minute-of-day comparisons, so this assumes a
// single same-day window (10:00–22:00) and doesn't handle a close time past
// midnight — not needed for these hours.
export function isShopOpenNow(hours, now = new Date()) {
  const colombo = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Colombo' }));
  const minutesNow = colombo.getHours() * 60 + colombo.getMinutes();

  const [openH, openM] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return minutesNow >= openMinutes && minutesNow < closeMinutes;
}
