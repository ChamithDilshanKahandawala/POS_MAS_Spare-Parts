const mongoose = require('mongoose');
const { SRI_LANKA_DISTRICTS } = require('../utils/sriLankaDistricts');

// Milestone 6 Part B defaults: Western Province districts start cheaper
// than the rest of the island; every other district gets the same flat
// starting rate until the owner sets it individually from the admin
// Settings page. Built once here (not left for callers to assume) so a
// freshly-created settings document already has a real, usable rate for
// every district — services/deliveryFee.js never has to guess at a
// missing one.
const WESTERN_PROVINCE_DISTRICTS = ['Colombo', 'Gampaha', 'Kalutara'];
function defaultDeliveryRates() {
  const rates = {};
  for (const district of SRI_LANKA_DISTRICTS) {
    rates[district] = WESTERN_PROVINCE_DISTRICTS.includes(district)
      ? { firstKgCents: 45000, additionalKgCents: 7500 }
      : { firstKgCents: 57500, additionalKgCents: 7500 };
  }
  return rates;
}

// Singleton document — always _id: 'platform-settings'. One row, never
// more; controllers/settingsController.js always upserts/reads by that
// fixed id rather than querying a collection of settings documents.
const platformSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'platform-settings' },
    defaultReturnWindowDays: { type: Number, default: 7 },
    payoutDayOfWeek: { type: Number, min: 0, max: 6, default: 1 }, // 0=Sunday
    payoutHoldDays: { type: Number, default: 3 },
    // Milestone 3: a seller's first N listings always go to review,
    // regardless of category rules, unless reviewExempt (Seller.js).
    reviewRequiredForFirstNListings: { type: Number, default: 20 },
    supportPhone: { type: String, default: '' },
    supportEmail: { type: String, default: '' },
    supportWhatsapp: { type: String, default: '' },
    // Milestone 2: merged with every category's own prohibitedKeywords
    // list (services/categoryRules.js's getEffectiveCategory) — a
    // platform-wide ban applies everywhere, a category-level one only
    // under that category.
    prohibitedKeywords: { type: [String], default: [] },

    // --- Milestone 6: ordering (Part A) ---
    // Owner-only, audited, OFF by default — see controllers/settingsController.js.
    // While false, marketplace checkout keeps showing the Milestone 5
    // "coming soon — order on WhatsApp" screen; real checkout only renders
    // once this is explicitly turned on. The checkout-placing route
    // itself also re-checks this server-side (never just hidden in the
    // UI) — see services/orderCreation.js.
    onlineOrderingEnabled: { type: Boolean, default: false },

    // --- Milestone 6: delivery fees (Part B) ---
    // A plain object keyed by exact SRI_LANKA_DISTRICTS name, not a Map —
    // Mongoose Maps serialize awkwardly through zod/JSON round trips for
    // very little benefit here (the key set is fixed and small). Every
    // district always has an entry (defaultDeliveryRates above); the
    // admin Settings page edits one district's rate at a time via a
    // dotted-path PATCH (settingsController.js merges deliveryRates
    // key-by-key rather than requiring the whole object every time).
    deliveryRates: {
      type: Object,
      default: defaultDeliveryRates,
    },
    courierName: { type: String, default: 'Transexpress' },

    // --- Milestone 6: auto-cancel (Part D) ---
    // Hours an unconfirmed (status:'new') seller order is allowed to sit
    // before services/orderAutoCancel.js cancels it and releases its
    // stock reservation.
    autoCancelAfterHours: { type: Number, default: 72, min: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
module.exports.defaultDeliveryRates = defaultDeliveryRates;
module.exports.WESTERN_PROVINCE_DISTRICTS = WESTERN_PROVINCE_DISTRICTS;
