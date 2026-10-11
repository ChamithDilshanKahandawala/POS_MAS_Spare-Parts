// Free-delivery threshold (LKR) shown on the cart page's progress bar.
// Matches the "Free shipping on orders above Rs. 5,000" copy already used in
// the announcement bar and hero section. Set to null to hide the bar entirely.
export const FREE_DELIVERY_THRESHOLD = 5000;

// WhatsApp number for the "Order on WhatsApp" button on the product detail
// page, in international format with no leading "+" or spaces (e.g.
// "94771234567"). Left empty on purpose — the button hides itself when this
// is falsy. Fill this in to turn the button on.
export const WHATSAPP_NUMBER = '94757203766';

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
