const mongoose = require('mongoose');

// Milestone 7 Part B.2 — one row from an uploaded remittance file, after
// matching against a delivered COD seller order by tracking number.
// 'duplicate' never actually gets PERSISTED with this status (a genuine
// duplicate — same trackingNumber+reference as an existing row — is
// recognized before insert and simply skipped, not written twice; the
// unique index below is what makes that safe even under a race); it's
// kept in the enum because services/remittance.js's upload response
// reports per-row outcomes using these same five literal strings, and a
// skipped row is reported as 'duplicate' there even though no row object
// for it exists in this collection.
const MATCH_STATUSES = ['matched', 'short', 'over', 'unknown_tracking', 'duplicate'];

const codRemittanceRowSchema = new mongoose.Schema(
  {
    courierName: { type: String, required: true, trim: true },
    trackingNumber: { type: String, required: true, trim: true },
    codAmountCents: { type: Number, required: true },
    remittanceDate: { type: Date, required: true },
    reference: { type: String, required: true, trim: true },
    matchStatus: { type: String, enum: MATCH_STATUSES, required: true },
    sellerOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerOrder', default: null },
    // The original parsed row, exactly as read from the uploaded file —
    // kept for the rare "why did this not match" support question,
    // never shown as a primary field anywhere.
    rawRow: { type: mongoose.Schema.Types.Mixed, default: null },
    uploadBatchId: { type: String, required: true }, // groups rows from one upload call together
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Part B.4 — "re-uploading the same file must not double-count (dedupe
// by tracking number + reference)". A genuinely later, separate
// remittance for the same tracking number (a short-pay topped up next
// week, say) has its own reference and is a different row.
codRemittanceRowSchema.index({ trackingNumber: 1, reference: 1 }, { unique: true });
codRemittanceRowSchema.index({ matchStatus: 1, createdAt: -1 });
codRemittanceRowSchema.index({ uploadBatchId: 1 });

module.exports = mongoose.model('CodRemittanceRow', codRemittanceRowSchema);
module.exports.MATCH_STATUSES = MATCH_STATUSES;
