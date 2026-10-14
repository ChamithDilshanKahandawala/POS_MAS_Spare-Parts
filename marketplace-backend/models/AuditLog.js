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

module.exports = mongoose.model('AuditLog', auditLogSchema);
