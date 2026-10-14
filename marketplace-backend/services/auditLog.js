const AuditLog = require('../models/AuditLog');

// The only function in this project that writes an AuditLog document.
// Call from every route that performs an admin-level mutation, after the
// mutation succeeds (so a failed action never produces a misleading log
// entry) — see routes/adminRoutes.js for the pattern.
async function logAction({ actor, actorRole, action, targetType, targetId, before = null, after = null, summary }) {
  return AuditLog.create({
    actor: actor._id,
    actorRole,
    action,
    targetType,
    targetId: String(targetId),
    before,
    after,
    summary,
  });
}

module.exports = { logAction };
