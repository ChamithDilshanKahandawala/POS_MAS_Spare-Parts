const AuditLog = require('../models/AuditLog');
const { clampLimit } = require('../utils/pagination');

const MAX_AUDIT_LOG_LIMIT = 200;

function buildQuery({ actor, action, targetType, from, to }) {
  const query = {};
  if (actor) query.actor = actor;
  if (action) query.action = action;
  if (targetType) query.targetType = targetType;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }
  return query;
}

// GET /api/admin/audit-log — read-only, no edit/delete route exists
// anywhere in this project (see models/AuditLog.js). "Time in Asia/
// Colombo" is a display concern, not a storage one — timestamps are
// stored as UTC as usual and the console formats them for display.
const listAuditLog = async (req, res) => {
  const { actor, action, targetType, from, to, page = 1, limit = 50 } = req.query;
  const query = buildQuery({ actor, action, targetType, from, to });
  const safeLimit = clampLimit(limit, 50, MAX_AUDIT_LOG_LIMIT);

  const [entries, total] = await Promise.all([
    AuditLog.find(query).populate('actor', 'name email').sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit),
    AuditLog.countDocuments(query),
  ]);

  res.json({ entries, total, page: Number(page), pages: Math.ceil(total / safeLimit) });
};

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// GET /api/admin/audit-log/export.csv — same filters as the list route,
// no pagination (the whole filtered set).
const exportAuditLogCsv = async (req, res) => {
  const { actor, action, targetType, from, to } = req.query;
  const query = buildQuery({ actor, action, targetType, from, to });

  const entries = await AuditLog.find(query).populate('actor', 'name email').sort({ createdAt: -1 });

  const header = ['Time (UTC)', 'Actor', 'Role', 'Action', 'Target type', 'Target ID', 'Summary'];
  const rows = entries.map((e) => [
    e.createdAt.toISOString(),
    e.actor?.name || e.actor?.email || String(e.actor),
    e.actorRole,
    e.action,
    e.targetType,
    e.targetId,
    e.summary,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');

  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="audit-log.csv"');
  res.send(csv);
};

module.exports = { listAuditLog, exportAuditLogCsv };
