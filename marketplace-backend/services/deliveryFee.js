// Milestone 6 Part B — one seller's parcel delivery fee, computed
// server-side only. The browser is shown the result of this (checkout
// preview) but the server always recomputes it fresh at order-placement
// time from the current PlatformSettings rates — never trusts a fee the
// client sent back.
const DEFAULT_WEIGHT_GRAMS = 1000; // 1kg, used when a listing has no real weight set

// Total parcel weight across every line, in whole kilograms rounded up —
// "fee = firstKg + additionalKg × (ceil(total parcel weight in kg) − 1)".
// Each line missing a real weight is assumed to be 1kg and flagged
// (weightEstimated) so the seller/admin can see which listing needs its
// weight filled in; the fee itself is still computed from that estimate,
// never blocked on it.
function computeParcelWeight(items) {
  let totalGrams = 0;
  const flagged = [];
  for (const item of items) {
    const perUnitGrams = item.weightGrams > 0 ? item.weightGrams : DEFAULT_WEIGHT_GRAMS;
    if (!(item.weightGrams > 0)) flagged.push(item.listingId);
    totalGrams += perUnitGrams * item.qty;
  }
  const weightKg = Math.max(1, Math.ceil(totalGrams / 1000));
  return { weightKg, flaggedListingIds: flagged };
}

// `rates` is one district's { firstKgCents, additionalKgCents } entry
// from PlatformSettings.deliveryRates.
function computeFeeCents(weightKg, rates) {
  if (!rates) throw new Error('No delivery rate configured for this district');
  return rates.firstKgCents + rates.additionalKgCents * (weightKg - 1);
}

module.exports = { computeParcelWeight, computeFeeCents, DEFAULT_WEIGHT_GRAMS };
