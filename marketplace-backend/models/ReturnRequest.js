const mongoose = require('mongoose');

const REASONS = ['wrong_item', 'damaged', 'not_as_described', 'missing_part', 'other'];
const STATUSES = [
  'requested',
  'seller_accepted',
  'seller_rejected',
  'escalated',
  'admin_decided',
  'item_returned',
  'refunded',
  'closed',
];
// A request in any of these states still holds its order lines' openReturnRequest claim.
const OPEN_STATUSES = ['requested', 'seller_accepted', 'seller_rejected', 'escalated', 'admin_decided', 'item_returned'];
const SHIPPING_PAYERS = ['platform', 'seller', 'customer'];
const REFUND_METHODS = ['bank_transfer', 'cash'];

const lineSchema = new mongoose.Schema(
  {
    sellerOrderItem: { type: mongoose.Schema.Types.ObjectId, required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    title: {
      en: { type: String, default: '' },
      si: { type: String, default: '' },
      ta: { type: String, default: '' },
    },
    sku: { type: String, default: '' },
    unitPriceCents: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byRole: { type: String, default: '' },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// One customer's return of 1+ lines from a single delivered seller order.
// Money effects are NOT stored here — they're LedgerEntry rows created in
// one transaction when the request reaches 'refunded' (services/returns.js).
const returnRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true },
    sellerOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerOrder', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber: { type: String, required: true },

    reason: { type: String, enum: REASONS, required: true },
    customerNote: { type: String, default: '' },
    photos: [{ path: { type: String, required: true } }],

    lines: { type: [lineSchema], validate: (v) => v.length > 0 },
    // Sum of unitPriceCents × qty across lines — the sale value being reversed.
    refundItemsCents: { type: Number, required: true, min: 0 },

    status: { type: String, enum: STATUSES, default: 'requested' },
    responseDeadlineAt: { type: Date, required: true },

    sellerNote: { type: String, default: '' },
    sellerRespondedAt: { type: Date, default: null },

    decision: { type: String, enum: ['refund', 'dismissed', null], default: null },
    adminNote: { type: String, default: '' },
    adminDecidedAt: { type: Date, default: null },

    receivedAt: { type: Date, default: null },

    resolution: {
      returnShippingPayer: { type: String, enum: [...SHIPPING_PAYERS, null], default: null },
      returnShippingCents: { type: Number, default: 0, min: 0 },
      customerRefundCents: { type: Number, default: 0, min: 0 },
      refundMethod: { type: String, enum: [...REFUND_METHODS, null], default: null },
      refundReference: { type: String, default: '' },
      refundedAt: { type: Date, default: null },
    },

    timeline: [timelineSchema],
  },
  { timestamps: true }
);

returnRequestSchema.index({ seller: 1, status: 1, createdAt: -1 });
returnRequestSchema.index({ customer: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, responseDeadlineAt: 1 });
returnRequestSchema.index({ sellerOrder: 1, status: 1 });

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
module.exports.REASONS = REASONS;
module.exports.STATUSES = STATUSES;
module.exports.OPEN_STATUSES = OPEN_STATUSES;
module.exports.SHIPPING_PAYERS = SHIPPING_PAYERS;
module.exports.REFUND_METHODS = REFUND_METHODS;
