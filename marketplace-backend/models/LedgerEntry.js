const mongoose = require('mongoose');

// Milestone 7 Part A — the append-only source of truth for every
// seller's money. Never updated except `status`/`payout` (see the two
// narrow updateOne()/updateMany() call sites in services/ledger.js and
// services/payoutRuns.js — there is no generic "edit a ledger entry"
// route anywhere, which is what actually keeps this append-only, not
// anything enforced by the schema itself). A correction is always a new
// entry (type: 'adjustment'), never a rewrite of an old one.
const TYPES = [
  'sale', // + to seller: the order's items total (never the delivery fee — see commission below)
  'commission', // − from seller: the platform's cut, snapshot rate, rounded once per seller order
  // Reserved for a future "seller fronts their own delivery cost" case —
  // nothing in Milestone 7 ever creates one yet (delivery fees are paid
  // to the courier directly, outside this ledger); kept in the enum now
  // so it's a real, already-migrated type whenever that need shows up,
  // same forward-guard pattern as SellerOrder.paymentMethod:'prepaid'.
  'delivery_fee_seller',
  'refused_parcel_charge', // − from seller: PlatformSettings.refusedParcelChargedTo === 'seller' only
  'adjustment', // owner-only manual correction, +/-, reason required
  'payout', // − from seller: created the moment a payout is marked paid (services/payoutRuns.js)
  'payout_reversal', // + to seller: created the moment a payout is marked failed, undoing the earmark
];

const STATUSES = ['on_hold', 'payable', 'in_payout', 'paid'];

const ledgerEntrySchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    type: { type: String, enum: TYPES, required: true },
    // Signed integer cents — never a float anywhere in this model or any
    // caller. + to the seller (sale, adjustment credit, payout_reversal),
    // − from the seller (commission, refused_parcel_charge, payout,
    // adjustment debit).
    amountCents: { type: Number, required: true, validate: Number.isInteger },
    sellerOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerOrder', default: null },
    payout: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout', default: null },
    status: { type: String, enum: STATUSES, default: 'on_hold' },
    // When a 'sale'/'commission' entry becomes eligible to move to
    // 'payable' (services/ledgerMaturity.js's daily sweep) — null for
    // entry types that are payable the moment they're created
    // (refused_parcel_charge, adjustment, payout, payout_reversal; see
    // each call site for why none of those have anything to wait out).
    availableAt: { type: Date, default: null },
    reason: { type: String, default: '' },
    // null for system-generated entries (sale/commission at delivery,
    // payout/payout_reversal at mark-paid/mark-failed) — only set for an
    // owner-authored 'adjustment'.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Part A.2's idempotency guarantee — "unique key on sellerOrderId + type
// so retries can't duplicate" — scoped to just the two types a retried
// delivery-transition could ever attempt to recreate. The REAL
// concurrency defense is services/ledger.js's atomic claim on
// SellerOrder.ledgerPostedAt (so two concurrent requests never even both
// try to insert); this index is the DB-level backstop the spec asks for
// on top of that, not a substitute for it.
ledgerEntrySchema.index(
  { sellerOrder: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: { $in: ['sale', 'commission'] } } }
);

// Seller Center's Finance ledger list (Part D) — filtered by seller,
// optionally by type/status, newest first.
ledgerEntrySchema.index({ seller: 1, createdAt: -1 });
// The daily on_hold -> payable sweep's own query.
ledgerEntrySchema.index({ status: 1, availableAt: 1 });
// Payout generation's "this seller's payable balance" query.
ledgerEntrySchema.index({ seller: 1, status: 1 });
// A payout's own entry list (review screen, bank export, mark paid/failed).
ledgerEntrySchema.index({ payout: 1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
module.exports.TYPES = TYPES;
module.exports.STATUSES = STATUSES;
