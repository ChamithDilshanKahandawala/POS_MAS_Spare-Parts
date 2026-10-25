const mongoose = require('mongoose');

const STATUSES = ['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'delivery_failed', 'returned'];
// Statuses the customer-facing "cancel order" button requires every
// parcel to still be in (controllers/customerOrdersController.js) —
// anything past this (packed and beyond) means the seller has already
// started physically handling it.
const CUSTOMER_CANCELLABLE_STATUSES = ['new', 'confirmed'];

// One seller's "parcel" within a customer's order — Order (models/Order.js)
// groups 1+ of these (one per distinct seller in the cart). This is where
// all the real state lives: status/timeline, stock reservation, delivery
// fee, and the line-item snapshot nothing later ever mutates.
const sellerOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true }, // APX-YYMM-NNNNN-1
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // A snapshot copy, same reasoning as Order.shippingAddress — this
    // parcel's own delivery fee was computed against this district at
    // order time and must never silently change if the customer's saved
    // address record is edited afterward.
    shippingAddress: {
      label: { type: String, default: '' },
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      city: { type: String, required: true },
      district: { type: String, required: true },
      landmark: { type: String, default: '' },
      phone: { type: String, required: true },
    },
    customerNote: { type: String, default: '' },

    // Everything a line needs to render and to never change again, even
    // if the listing's price/title/commission rate changes later —
    // "snapshot at order time" per the spec. listing is kept as a
    // reference too (so a seller/admin can still jump to the live
    // listing), but nothing here is ever re-read from it after creation.
    items: [{
      listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
      title: {
        en: { type: String, default: '' },
        si: { type: String, default: '' },
        ta: { type: String, default: '' },
      },
      sku: { type: String, default: '' },
      unitPriceCents: { type: Number, required: true },
      qty: { type: Number, required: true, min: 1 },
      lineTotalCents: { type: Number, required: true },
      weightGrams: { type: Number, required: true },
      // True when the listing had no real weightGrams at order time and
      // a 1kg default was assumed for the fee calc (Part B) — surfaced to
      // seller/admin so they know to go fix the listing's real weight,
      // never shown to the customer.
      weightEstimated: { type: Boolean, default: false },
      commissionRateBps: { type: Number, required: true },
      // Per-line reservation lifecycle (Part D): 'active' holds real stock
      // back from other buyers; 'released' means the hold was freed
      // without ever becoming a permanent deduction (order/line
      // cancelled, or — for a POS-linked seller — the sale was confirmed
      // recorded in the POS instead); 'consumed' means it WAS turned into
      // a permanent stock deduction (a non-POS seller's normal "mark
      // shipped"); 'returned' means a delivery failure was followed by a
      // "mark returned" (follow-up) — for a non-POS seller the deduction
      // was reversed back onto `stock`, for a POS-linked seller nothing
      // here changed (their stock lives in the POS). See
      // services/stockReservation.js — the only thing that ever changes
      // this.
      reservationStatus: { type: String, enum: ['active', 'released', 'consumed', 'returned'], default: 'active' },
    }],

    itemsTotalCents: { type: Number, required: true },
    deliveryFeeCents: { type: Number, required: true },
    codAmountCents: { type: Number, required: true }, // itemsTotalCents + deliveryFeeCents — what the courier collects on delivery
    weightKg: { type: Number, required: true }, // ceil'd total parcel weight the fee was computed from

    // Follow-up — every order today is Cash on Delivery (nothing is ever
    // collected up front, so a failed/cancelled COD order has no money to
    // refund); this is forward cover for Milestone 7's online payments,
    // set at order-creation time and never changed afterward. See
    // refundNeeded below — the one thing this field actually gates today.
    paymentMethod: { type: String, enum: ['cod', 'prepaid'], default: 'cod' },
    // Follow-up — the courier trip was still made and still costs money
    // even though the delivery failed; set to deliveryFeeCents the moment
    // a parcel is marked returned, so Milestone 7's seller/platform
    // accounting has a real number for "wasted" deliveries instead of
    // having to re-derive it from the delivery fee of a parcel that may
    // since have had its own fee basis change (rates are not versioned).
    refusedParcelCostCents: { type: Number, default: 0 },
    // Follow-up — set true the moment a PREPAID (paymentMethod !== 'cod')
    // order is cancelled or returned, at every place that can cancel one
    // (seller, customer, admin, the auto-cancel job) or mark one returned —
    // never cleared automatically, so it stays a visible, durable "this
    // needs a human to actually refund someone" flag in Admin → Orders
    // until Milestone 7's real refund flow exists to resolve it. Always
    // false today since every order is COD — this is the guard rail for
    // when that stops being true.
    refundNeeded: { type: Boolean, default: false },

    status: { type: String, enum: STATUSES, default: 'new' },
    statusHistory: [{
      from: { type: String, default: null },
      to: { type: String, required: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null for the system auto-cancel job
      reason: { type: String, default: '' },
      at: { type: Date, default: Date.now },
    }],
    cancelReason: { type: String, default: '' },

    courier: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },

    confirmedAt: { type: Date, default: null },
    packedAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // Milestone 4's Seller 1 (POS-connected) only — see Part D. Checking
    // this is what actually releases that seller's stock reservation; a
    // POS-linked seller's "mark shipped" deliberately does NOT release it
    // (the real stock number lives in the POS, not here, until the next
    // sync picks up what the seller recorded there).
    posRecorded: { type: Boolean, default: false },
    posRecordedAt: { type: Date, default: null },
    // Follow-up — a SEPARATE checkbox from posRecorded above: that one
    // tracks whether the original SALE was recorded in the POS, this one
    // tracks whether the RETURN was (a POS-connected seller's "mark
    // returned" never touches marketplace stock — see the 'returned'
    // branch in controllers/sellerOrdersController.js — so the reminder
    // job needs to know separately whether the seller has gone and
    // recorded the item coming back into their POS stock).
    returnPosRecorded: { type: Boolean, default: false },
    returnPosRecordedAt: { type: Date, default: null },
    // Follow-up — set once the "not yet recorded in POS" reminder
    // (services/posRecordedReminder.js) has fired for this order —
    // shared by both the sale-recording reminder (Shipped/Delivered,
    // posRecorded:false) and the return-recording reminder (Returned,
    // returnPosRecorded:false): an order is only ever in one of those two
    // states at a time, so one "last warned at" timestamp is enough for
    // either. The claim itself is atomic (an $or-conditioned
    // findOneAndUpdate, see posRecordedReminder.js) so the daily sweep
    // never double-notifies even if two instances of this job ran at once.
    posNotRecordedWarnedAt: { type: Date, default: null },

    // Follow-up — set once a failed/refused delivery has been marked
    // "Returned to seller" (the non-POS stock reversal, or the POS
    // reminder, already ran) — the TRANSITIONS table alone already
    // blocks re-running this (only delivery_failed -> returned is
    // allowed), but this timestamp is still kept as the visible, audited
    // record of when it happened.
    returnedAt: { type: Date, default: null },

    // Admin-only free-text notes (Part F) — never seller- or
    // customer-visible, so kept entirely separate from statusHistory's
    // `reason` (which IS seller-visible, e.g. a cancel reason).
    internalNotes: [{
      text: { type: String, required: true },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      at: { type: Date, default: Date.now },
    }],

    // Set at creation to createdAt + PlatformSettings.autoCancelAfterHours
    // — services/orderAutoCancel.js queries on this directly rather than
    // recomputing "createdAt + current setting" at sweep time, so a later
    // change to the setting never retroactively changes the deadline an
    // already-placed order was promised. Cleared (set to null) the moment
    // the order leaves 'new', so the sweep's query can stay a simple
    // {status:'new', autoCancelAt: {$lte: now}} without also re-checking
    // status against a stale deadline.
    autoCancelAt: { type: Date, default: null },
    // Set once the "12h before auto-cancel" warning notification has been
    // sent, so the sweep never sends it twice for the same parcel.
    autoCancelWarnedAt: { type: Date, default: null },

    // --- Milestone 7 Part A/B ---
    // Set the moment services/ledger.js's postDeliveryLedgerEntries() has
    // created this order's sale+commission LedgerEntry pair — the atomic
    // claim that makes "exactly once" real (a findOneAndUpdate filtered
    // on this being null), not just the belt-and-suspenders unique index
    // on LedgerEntry itself. Never cleared once set.
    ledgerPostedAt: { type: Date, default: null },
    // Part B.2/B.3 — set once a CodRemittanceRow has matched this order's
    // tracking number with a COD amount equal to codAmountCents (an
    // exact 'matched' row only — 'short'/'over' never set this, since
    // the money received didn't actually equal what's owed). The sale
    // entry can only become 'payable' once this is true AND availableAt
    // has passed — see services/ledgerMaturity.js.
    codMatched: { type: Boolean, default: false },
    codMatchedAt: { type: Date, default: null },
    codRemittanceRow: { type: mongoose.Schema.Types.ObjectId, ref: 'CodRemittanceRow', default: null },
  },
  { timestamps: true }
);

// Seller Center's order list: filtered by seller + status (tabs), newest
// first.
sellerOrderSchema.index({ seller: 1, status: 1, createdAt: -1 });
// Customer's own order list/detail.
sellerOrderSchema.index({ customer: 1, createdAt: -1 });
// The auto-cancel sweep's own query.
sellerOrderSchema.index({ status: 1, autoCancelAt: 1 });
// The "not yet recorded in POS" sweep and the Seller Orders filter of
// the same name (sale side) — both filter on exactly these three fields.
sellerOrderSchema.index({ seller: 1, posRecorded: 1, status: 1 });
// Same, for the return side of that reminder/filter.
sellerOrderSchema.index({ seller: 1, returnPosRecorded: 1, status: 1 });
// Admin's filtered list (seller/status/date/district/payment — COD only
// today, so "payment" isn't indexed separately) and search-by-order-number.
sellerOrderSchema.index({ status: 1, createdAt: -1 });
sellerOrderSchema.index({ 'shippingAddress.district': 1, createdAt: -1 });
// Admin's "Refund needed" filter.
sellerOrderSchema.index({ refundNeeded: 1, createdAt: -1 });
// Remittance matching (Part B.2) — find a seller order by tracking
// number. Not unique: two different sellers' parcels on two different
// orders could coincidentally reuse a tracking number format, but never
// the same literal tracking number from the same real courier, so in
// practice this is effectively unique without needing to declare it as
// such (declaring it unique would make seed/test fixtures that reuse a
// placeholder tracking number across runs fail for an unrelated reason).
sellerOrderSchema.index({ trackingNumber: 1 });
// Admin Finance's "COD not received" query (Part B.2) and the daily
// payable sweep's COD-matched check (Part B.3).
sellerOrderSchema.index({ status: 1, paymentMethod: 1, codMatched: 1, deliveredAt: 1 });

module.exports = mongoose.model('SellerOrder', sellerOrderSchema);
module.exports.STATUSES = STATUSES;
module.exports.CUSTOMER_CANCELLABLE_STATUSES = CUSTOMER_CANCELLABLE_STATUSES;
