const mongoose = require('mongoose');

const CONDITIONS = ['new', 'used', 'reconditioned'];
const WARRANTY_TYPES = ['none', 'days', 'months'];
const STATUSES = ['draft', 'in_review', 'published', 'rejected', 'hidden', 'suspended'];

// Fixed picklist for controllers/adminListingsController.js's reject —
// "one or more reasons from a list" per the spec, not free text alone.
const REJECTION_REASONS = [
  'photo_mismatch',
  'missing_registration',
  'price_wrong',
  'prohibited_item',
  'poor_photos',
  'wrong_category',
  'contact_in_text',
  'other',
];

const localizedTextSchema = {
  en: { type: String, default: '' },
  si: { type: String, default: '' },
  ta: { type: String, default: '' },
};

// A listing's own products-page row + full editable content. `attributes`
// is a plain object (not Map) — the key set tracks the owning category's
// effective attributeSchema keys and is validated against that at
// submit/save time (services/listingChecks.js), not by Mongoose itself.
const listingSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },

    title: localizedTextSchema,
    description: localizedTextSchema,

    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, default: '', trim: true },
    condition: { type: String, enum: CONDITIONS, default: 'new' },
    sku: { type: String, default: '', trim: true },

    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    fitment: [{
      makeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleMake' },
      modelName: { type: String, default: '' },
      yearFrom: { type: Number, default: null },
      yearTo: { type: Number, default: null },
    }],

    // Order IS display order; images[0] is always the cover — no separate
    // "cover" pointer to keep in sync.
    images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Media' }],

    priceCents: { type: Number, default: 0 },
    wasPriceCents: { type: Number, default: null },
    priceHistory: [{
      priceCents: { type: Number, required: true },
      setAt: { type: Date, default: Date.now },
    }],

    stock: { type: Number, default: 0 },
    lowStockAlert: { type: Number, default: null },
    weightGrams: { type: Number, default: 0 },
    // Weight feeds delivery-fee calculation, so every change is logged —
    // unlike sku/dimensions/warranty, which are instant-apply but untracked.
    weightHistory: [{
      weightGrams: { type: Number, required: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date, default: Date.now },
    }],
    dimensions: {
      l: { type: Number, default: null },
      w: { type: Number, default: null },
      h: { type: Number, default: null },
    },
    warranty: {
      type: { type: String, enum: WARRANTY_TYPES, default: 'none' },
      value: { type: Number, default: 0 },
    },

    status: { type: String, enum: STATUSES, default: 'draft' },
    statusHistory: [{
      from: { type: String, default: null },
      to: { type: String, required: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, default: '' },
      at: { type: Date, default: Date.now },
    }],
    rejectionReasons: { type: [String], enum: REJECTION_REASONS, default: [] },
    rejectionNote: { type: String, default: '' },

    // A pending content revision on an otherwise-live listing — the live
    // document's own fields (title/description/images/categoryId/
    // attributes/fitment/brand/condition) stay exactly as published until
    // an admin approves this, at which point they're merged in and this
    // is cleared. null fields = no pending revision right now.
    pendingRevision: {
      fields: { type: mongoose.Schema.Types.Mixed, default: null },
      submittedAt: { type: Date, default: null },
    },

    // Set when the owning category's attributeSchema gains a new required
    // field after this listing was last saved (services/listingDrift.js) —
    // the listing stays published/live, just flagged for the seller to
    // revisit. categorySchemaVersion is the Category.schemaVersion this
    // listing's attributes were last validated against.
    needsUpdate: { type: Boolean, default: false },
    categorySchemaVersion: { type: Number, default: 0 },

    version: { type: Number, default: 1 },
    firstPublishedAt: { type: Date, default: null }, // drives the seller's probation-listing count
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

listingSchema.index({ seller: 1, status: 1 });
listingSchema.index({ categoryId: 1, status: 1 });
listingSchema.index({ 'title.en': 'text', 'description.en': 'text', sku: 'text', brand: 'text' });
// adminListingsController.js's listReviewQueue: oldest-first, filtered by
// status (in_review, or published/hidden for a pending revision).
// There's no separate "submittedAt" field on a listing — updatedAt is
// what the queue actually sorts by, so that's what this indexes.
listingSchema.index({ status: 1, updatedAt: 1 });
// publicListingsController.js's listPublicListings: status is always
// 'published' here, category is the most common filter, priceCents is
// both a range filter (priceMin/priceMax) and a sort key.
listingSchema.index({ status: 1, categoryId: 1, priceCents: 1 });
// The "newest first" sort (the default) uses publishedAt, not
// priceCents — covered separately since a single compound index can't
// serve both sort orders well at once.
listingSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Listing', listingSchema);
module.exports.CONDITIONS = CONDITIONS;
module.exports.WARRANTY_TYPES = WARRANTY_TYPES;
module.exports.STATUSES = STATUSES;
module.exports.REJECTION_REASONS = REJECTION_REASONS;
