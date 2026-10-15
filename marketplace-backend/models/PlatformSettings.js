const mongoose = require('mongoose');

// Singleton document — always _id: 'platform-settings'. One row, never
// more; controllers/settingsController.js always upserts/reads by that
// fixed id rather than querying a collection of settings documents.
const platformSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'platform-settings' },
    defaultReturnWindowDays: { type: Number, default: 7 },
    payoutDayOfWeek: { type: Number, min: 0, max: 6, default: 1 }, // 0=Sunday
    payoutHoldDays: { type: Number, default: 3 },
    reviewRequiredForFirstNListings: { type: Number, default: 5 },
    supportPhone: { type: String, default: '' },
    supportEmail: { type: String, default: '' },
    supportWhatsapp: { type: String, default: '' },
    // Milestone 2: merged with every category's own prohibitedKeywords
    // list (services/categoryRules.js's getEffectiveCategory) — a
    // platform-wide ban applies everywhere, a category-level one only
    // under that category.
    prohibitedKeywords: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
