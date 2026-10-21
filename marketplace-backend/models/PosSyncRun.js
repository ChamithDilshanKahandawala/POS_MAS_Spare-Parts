const mongoose = require('mongoose');

// One row per sync attempt (scheduled or manual "Sync now") — read-only
// history for the seller's and admin's POS connection panels. Nothing
// ever updates or deletes one of these once finished; a new attempt is
// always a new document, same append-only spirit as AuditLog.
const posSyncRunSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    trigger: { type: String, enum: ['scheduled', 'manual'], required: true },
    status: { type: String, enum: ['running', 'success', 'failed'], default: 'running' },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    productsChecked: { type: Number, default: 0 },
    listingsUpdated: { type: Number, default: 0 },
    errors: { type: [String], default: [] },
  },
  { timestamps: true }
);

posSyncRunSchema.index({ seller: 1, startedAt: -1 });

module.exports = mongoose.model('PosSyncRun', posSyncRunSchema);
