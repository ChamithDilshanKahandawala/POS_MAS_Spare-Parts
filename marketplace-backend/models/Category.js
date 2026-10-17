const mongoose = require('mongoose');

const MAX_DEPTH = 2; // 0 = root, 1 = child, 2 = grandchild — "3 levels" total
const FIELD_TYPES = ['text', 'number', 'select', 'multiselect', 'boolean', 'date', 'fitment'];

const localizedText = (opts = {}) => ({
  en: { type: String, default: '', trim: true },
  si: { type: String, default: '', trim: true },
  ta: { type: String, default: '', trim: true },
  ...opts,
});

const fieldOptionSchema = new mongoose.Schema({
  value: { type: String, required: true, trim: true },
  label: localizedText(),
}, { _id: false });

// One field in a category's listing form (Milestone 3 reads this to
// build the form). `key` is the stable identifier a listing's attribute
// values are stored under — immutable once the category has listings,
// enforced in controllers/adminCategoriesController.js by counting real
// Listing documents before allowing a rename, never here (the schema
// itself has no way to know "the old value"). Keeps its own real `_id`
// (Mongoose's default for a subdocument) SEPARATE from `key` specifically
// so a rename (same _id, different key) can be told apart from a
// remove-and-add (different _id entirely) — that distinction is exactly
// what the immutable-key rule needs to check.
const attributeFieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: localizedText(),
  helpText: localizedText(),
  type: { type: String, enum: FIELD_TYPES, required: true },
  required: { type: Boolean, default: false },
  options: { type: [fieldOptionSchema], default: [] }, // select/multiselect
  unit: { type: String, default: '' }, // number
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  maxLength: { type: Number, default: null }, // text
  showOnProductPage: { type: Boolean, default: true },
  filterable: { type: Boolean, default: false },
}); // real _id (Mongoose default) — see the comment above this schema

// Nullable (default null, not false/0) on purpose — null means "not set
// here, inherit from the nearest ancestor that sets it"
// (services/categoryRules.js). An explicit false/0 is a real override,
// never confused with "unset".
const categorySchema = new mongoose.Schema(
  {
    name: localizedText(),
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    depth: { type: Number, required: true, min: 0, max: MAX_DEPTH },
    icon: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },

    // Standalone — never inherited from a parent (unlike everything else
    // below). Owner-only to change (routes/adminRoutes.js).
    commissionRateBps: { type: Number, min: 0, max: 5000, default: 0 },

    returnPolicy: {
      returnable: { type: Boolean, default: null },
      windowDays: { type: Number, default: null },
      note: localizedText(),
    },
    // Milestone 3: minimum warranty a listing in this category must
    // offer, in months (0/null = no minimum). Nullable-sentinel, inherits
    // like returnPolicy — an explicit 0 is a real "no minimum required"
    // override, not "unset".
    warrantyRule: {
      minMonths: { type: Number, default: null },
    },
    regulated: { type: Boolean, default: null },
    reviewRequired: { type: Boolean, default: null },
    prohibitedKeywords: { type: [String], default: [] },

    attributeSchema: { type: [attributeFieldSchema], default: [] },
    schemaVersion: { type: Number, default: 1 },

    // Display-only counter for the Catalog page — nudged by +1/-1
    // wherever a listing's categoryId is set/changed/removed
    // (sellerListingsController.js, adminListingsController.js). It can
    // drift from reality (a direct DB write bypassing those controllers
    // skips it entirely), so nothing that GATES a write on "does this
    // category have listings" trusts this field — those checks in
    // controllers/adminCategoriesController.js count real Listing
    // documents instead. Rebuild it with `npm run recount:categories`.
    listingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.index({ parentId: 1, sortOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);
module.exports.MAX_DEPTH = MAX_DEPTH;
module.exports.FIELD_TYPES = FIELD_TYPES;
