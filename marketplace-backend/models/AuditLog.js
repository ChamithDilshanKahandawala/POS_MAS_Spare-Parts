const mongoose = require('mongoose');

// Append-only. No route in this project ever updates or deletes an
// AuditLog document — see services/auditLog.js (the only thing that
// writes here) and routes/adminRoutes.js (the only thing that reads it).
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true }, // snapshot at action time — platformRole or a seller role
    action: { type: String, required: true }, // e.g. "seller.status.update"
    targetType: { type: String, required: true }, // e.g. "Seller"
    targetId: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    summary: { type: String, required: true },
  },
  { timestamps: true }
);

// Serves getSellerDetail's "recent activity" tab and sellerActivity
// Controller's listActivity — both filter by exactly targetType+targetId,
// sorted newest first.
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
// listAuditLog's own filters (actor/action/date-range) are each optional
// and used in combination, so a single compound index can't cover every
// shape — this one serves the single most common one (the admin log
// screen's default view: just date-sorted, often narrowed by action).
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
