const mongoose = require('mongoose');

// Milestone 7 Part C — the weekly batch. One PayoutRun has many Payout
// documents (models/Payout.js), one per seller included in that week.
// 'draft' can still have sellers removed from it (services/payoutRuns.js's
// removeSellerFromRun); 'approved' is locked — no further edits, only
// mark-paid/mark-failed on its individual Payouts from then on.
const payoutRunSchema = new mongoose.Schema(
  {
    // ISO week key, e.g. "2026-W04" — the idempotency key for "generating
    // the same week's run twice gives one run" (Part C.7/C.1): a unique
    // index below, not an application-level check, so two concurrent
    // generation requests can't both create a run for the same week (the
    // loser's insert throws 11000, caught by services/payoutRuns.js the
    // same way services/orderCreation.js already handles a raced
    // idempotencyKey).
    weekKey: { type: String, required: true, unique: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'approved'], default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null for the weekly job
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PayoutRun', payoutRunSchema);
