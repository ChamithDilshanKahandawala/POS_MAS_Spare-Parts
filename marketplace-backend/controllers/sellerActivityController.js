const AuditLog = require('../models/AuditLog');
const { clampLimit } = require('../utils/pagination');

const MAX_ACTIVITY_LIMIT = 100;

// GET /api/seller/activity — this store's own audit entries only
// (targetType: 'Seller', targetId: this seller), which already includes
// admin "view as seller" visits (controllers/adminSellersController.js's
// viewAsSeller logs exactly this shape) alongside every seller-initiated
// write (profile/logo/banner/bank/staff — all logged the same way).
// Read-only: there's no edit/delete route anywhere for AuditLog.
const listActivity = async (req, res) => {
  const { actor, from, to, page = 1, limit = 50 } = req.query;
  const query = { targetType: 'Seller', targetId: req.sellerId.toString() };
  if (actor) query.actor = actor;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const safeLimit = clampLimit(limit, 50, MAX_ACTIVITY_LIMIT);
  const [entries, total] = await Promise.all([
    AuditLog.find(query).populate('actor', 'name email').sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit),
    AuditLog.countDocuments(query),
  ]);

  res.json({ entries, total, page: Number(page), pages: Math.ceil(total / safeLimit) });
};

module.exports = { listActivity };
