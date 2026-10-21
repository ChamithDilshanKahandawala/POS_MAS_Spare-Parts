const AuditLog = require('../models/AuditLog');
const { maskAuditSnapshot } = require('../utils/maskAuditSnapshot');

// The only function in this project that writes an AuditLog document.
// Call from every route that performs an admin-level mutation, after the
// mutation succeeds (so a failed action never produces a misleading log
// entry) — see routes/adminRoutes.js for the pattern.
//
// before/after always go through maskAuditSnapshot() here, not at each
// call site — every current caller already hand-picks safe fields, but
// this is the one place that can't be skipped by a future change that
// forgets to.
async function logAction({ actor, actorRole, action, targetType, targetId, before = null, after = null, summary }) {
  return AuditLog.create({
    actor: actor._id,
    actorRole,
    action,
    targetType,
    targetId: String(targetId),
    before: maskAuditSnapshot(before),
    after: maskAuditSnapshot(after),
    summary,
  });
}

module.exports = { logAction };
