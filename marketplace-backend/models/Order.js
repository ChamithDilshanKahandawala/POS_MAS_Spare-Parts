const mongoose = require('mongoose');
const { SRI_LANKA_DISTRICTS } = require('../utils/sriLankaDistricts');

// The customer-facing "order" a checkout produces — a thin grouping
// wrapper around one or more SellerOrder documents (one per seller in the
// cart, "parcels"). There is deliberately no top-level `status` here: an
// order's real state always lives per-parcel on SellerOrder (a 2-seller
// order can be "shipped" for one seller and "new" for the other at the
// same time), so a single combined status here would either be wrong or
// just duplicate data that can drift. Every money field is a snapshot
// total computed once at creation (sum across the seller orders created
// in the same transaction) — never recomputed later, so it stays correct
// even after a parcel is cancelled (see SellerOrder.status).
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true }, // APX-YYMM-NNNNN
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // One checkout's idempotency key, generated client-side (a UUID) and
    // sent on every attempt to place THIS cart — a double click or a
    // retried request after a dropped response reuses the same key, so
    // services/orderCreation.js can recognize "already placed" and return
    // the existing order instead of creating a second one. Scoped to the
    // customer (not globally unique) so two different customers can never
    // collide even in the astronomically unlikely event their client
    // generated the same UUID.
    idempotencyKey: { type: String, required: true },

    // A snapshot copy of the address used, not a live reference — editing
    // or deleting the saved address later must never change what an
    // already-placed order says it shipped to.
    shippingAddress: {
      label: { type: String, default: '' },
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      city: { type: String, required: true },
      district: { type: String, enum: SRI_LANKA_DISTRICTS, required: true },
      landmark: { type: String, default: '' },
      phone: { type: String, required: true },
    },
    customerNote: { type: String, default: '', trim: true, maxlength: 500 },

    sellerOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SellerOrder' }],

    itemsTotalCents: { type: Number, required: true },
    deliveryTotalCents: { type: Number, required: true },
    grandTotalCents: { type: Number, required: true },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);
