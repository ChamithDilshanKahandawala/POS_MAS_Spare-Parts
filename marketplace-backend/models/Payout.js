const mongoose = require('mongoose');

// Milestone 7 Part C — one seller's slice of a PayoutRun.
//
// Status lifecycle:
//   'blocked'            — payable balance met the minimum, but the
//                           seller has no VERIFIED bank account. Created
//                           for visibility in the review screen only;
//                           its entries were never claimed (they're still
//                           sitting at LedgerEntry.status:'payable',
//                           payout:null) so they roll straight into the
//                           next run once the bank account is verified.
//   'settled_internally'  — an internal seller (Seller.settlementMode)
//                           — no bank transfer ever happens, so this is
//                           already a terminal state the moment the run
//                           is generated; its entries go straight to
//                           LedgerEntry.status:'paid'.
//   'in_payout'            — a real bank payout, entries claimed
//                           (LedgerEntry.status:'in_payout'), waiting on
//                           the owner to mark it paid or failed. Only a
//                           payout in THIS state, inside an APPROVED run,
//                           is ever included in the bank export.
//   'paid'                — mark-paid happened; entries -> 'paid', a
//                           'payout' LedgerEntry was created.
//   'failed'               — mark-failed happened; entries -> 'payable'
//                           again (payout:null), a 'payout_reversal'
//                           LedgerEntry was created.
const STATUSES = ['blocked', 'settled_internally', 'in_payout', 'paid', 'failed'];

const payoutSchema = new mongoose.Schema(
  {
    payoutRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayoutRun', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    status: { type: String, enum: STATUSES, required: true },
    settlementMode: { type: String, enum: ['payout', 'internal'], required: true }, // snapshot at generation time

    // Breakdown, all integer cents — gross sales (every included 'sale'
    // entry), commission (every included 'commission' entry, already
    // negative), charges (refused_parcel_charge, negative), adjustments
    // (can be either sign), net = the sum of all four = the actual bank
    // transfer amount.
    grossSalesCents: { type: Number, required: true, default: 0 },
    commissionCents: { type: Number, required: true, default: 0 },
    chargesCents: { type: Number, required: true, default: 0 },
    adjustmentsCents: { type: Number, required: true, default: 0 },
    netCents: { type: Number, required: true, default: 0 },

    // The LedgerEntry ids claimed into this payout at generation time —
    // every review/export/mark-paid/mark-failed action works off this
    // list rather than re-querying "every entry with payout:this._id"
    // each time, so the included set can never silently drift.
    entries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry' }],

    // A display-only snapshot (last4, never the full number — see
    // controllers/adminPayoutController.js's exportBankCsv, the ONE
    // place the full number is ever re-fetched, live, and only with a
    // fresh step-up). Null for a 'blocked' or 'settled_internally' payout.
    bankSnapshot: {
      bankName: { type: String, default: '' },
      branch: { type: String, default: '' },
      accountName: { type: String, default: '' },
      last4: { type: String, default: '' },
    },

    paidAt: { type: Date, default: null },
    paidReference: { type: String, default: '' },
    failedAt: { type: Date, default: null },
    failedReason: { type: String, default: '' },
  },
  { timestamps: true }
);

payoutSchema.index({ payoutRun: 1, seller: 1 }, { unique: true });
// Seller Center's own payout history (Part D).
payoutSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('Payout', payoutSchema);
module.exports.STATUSES = STATUSES;
