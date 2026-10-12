// We don't offer free delivery — every order ships via a paid courier (see
// DELIVERY_OPTIONS below). null hides the cart page's free-delivery
// progress bar entirely (see OrderSummary.jsx); don't set this to a number
// without actually offering free delivery above that threshold.
export const FREE_DELIVERY_THRESHOLD = null;

// WhatsApp number for the "Order on WhatsApp" button on the product detail
// page, in international format with no leading "+" or spaces (e.g.
// "94771234567"). Left empty on purpose — the button hides itself when this
// is falsy. Fill this in to turn the button on.
export const WHATSAPP_NUMBER = '94757203766';

// Single source of truth for every piece of real-world shop detail shown
// anywhere in the storefront (footer, /about, /contact, /delivery,
// /privacy, /terms, order-success, WhatsApp links, JSON-LD). Don't
// hard-code the name/phone/email/address anywhere else — import from here.
export const SHOP_INFO = {
  name: 'Mudiyanse Auto Solutions',
  addressLines: ['No. 08, New Shopping Complex', 'Mirigama'],
  district: 'Gampaha',
  province: 'Western Province',
  country: 'Sri Lanka',
  mapsUrl: 'https://maps.app.goo.gl/YEnxk9U9pmy8thfV7',
  mapsEmbedQuery: 'Mudiyanse Auto Solutions, New Shopping Complex, Mirigama',
  // Display as "075 720 3766" / "075 156 3766" — see formatPhoneDisplay().
  phones: ['0757203766', '0751563766'],
  whatsapp: WHATSAPP_NUMBER,
  email: 'mudiyanseautosolutions@gmail.com',
  // Display as "Open daily, 10.00 AM – 10.00 PM" — see the contact page's
  // live open/closed badge (utils/openStatus.js) for how open/close are used.
  hours: { open: '10:00', close: '22:00', days: 'every day' },
  brNumber: 'WP/GAM/MI/2025/00255',
};

// '0757203766' -> '075 720 3766'. Local 10-digit numbers only (the only
// format SHOP_INFO.phones uses) — anything else is returned unchanged
// rather than mis-grouped.
export function formatPhoneDisplay(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
}

// Delivery fee numbers shown on /delivery, and referenced (via i18next
// interpolation, not hard-coded JSX) wherever the storefront mentions a
// delivery price — cart drawer, /cart, checkout. Transexpress is listed
// first because it's the only option actually offered at checkout today
// (see CheckoutPage.jsx); SL Speed Post is documented for customers who
// want it but requires contacting us on WhatsApp first to arrange payment,
// since it doesn't support Cash on Delivery.
export const DELIVERY_OPTIONS = [
  {
    id: 'transexpress',
    name: 'Transexpress Courier',
    etaDays: '2–5',
    codAvailable: true,
    pricing: {
      westernFirstKg: 450,
      otherFirstKgMin: 450,
      otherFirstKgMax: 575,
      additionalPerKg: 75,
    },
  },
  {
    id: 'slpost',
    name: 'SL Speed Post (Sri Lanka Post)',
    etaDays: '2–5',
    codAvailable: false,
    pricing: {
      anywhereFirstKg: 375,
      additionalPerKg: 50,
    },
  },
];

// How many days after delivery a customer can report a problem (wrong
// item, damaged in transit, not as described) — see /returns.
export const RETURN_WINDOW_DAYS = 7;

// The real category list, matching backend/models/Product.js's `category`
// enum exactly. Single source of truth — StorefrontPage's pills, the navbar's
// "Shop by category", the footer's quick links, and CategoryPage's
// not-found suggestions all import this instead of hardcoding their own
// (StorefrontPage used to hardcode a subset that silently omitted
// Electronics, Company Item and ANYVEHICLE — fixed by centralizing here).
export const CATEGORIES = [
  'Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road',
  'KeyTag', 'Toys', 'Ornaments', 'Electronics', 'Company Item', 'ANYVEHICLE',
];

// Simple district -> delivery estimate rule for the order-success page.
// There's no stored `district` field on a Sale (backend/models/Sale.js) —
// CheckoutPage concatenates it into the single `shipping_address` string
// ("${address}, ${city}, ${district}"), so the order-success page parses
// the district back out of that string (its last comma-separated segment)
// before looking it up here. An unrecognized/unparseable district falls
// back to DEFAULT_DELIVERY_ESTIMATE.
export const DEFAULT_DELIVERY_ESTIMATE = '2–4 working days';
export const DELIVERY_ESTIMATE_BY_DISTRICT = {
  Colombo: '1–2 working days',
  Gampaha: '1–2 working days',
  Kalutara: '2–3 working days',
};

export function getDeliveryEstimate(district) {
  return DELIVERY_ESTIMATE_BY_DISTRICT[district] || DEFAULT_DELIVERY_ESTIMATE;
}

// Payment methods shown as badges in the footer. The storefront is Cash on
// Delivery only right now (no card/online gateway is wired up), so this is
// a single entry — add PayHere/card entries here later and the footer picks
// them up automatically. `labelKey` is looked up in the footer i18n
// namespace (translations/review-sheet.csv tracks the en/si/ta copy).
export const PAYMENT_BADGES = [
  { code: 'COD', labelKey: 'bottomBar.cashOnDelivery' },
];
