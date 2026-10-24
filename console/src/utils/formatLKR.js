// Milestone 6 — every order money field from the API is in cents
// (priceCents-style, same convention as marketplace-backend throughout).
// No shared currency formatter existed in console before this (product
// prices were shown as plain "Rs {value}" inline) — this is the first
// place money needs real thousands separators (order totals/fees).
const nf = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatLKR(cents) {
  return `Rs. ${nf.format((cents || 0) / 100)}`;
}
