const Seller = require('../models/Seller');
const { logAction } = require('../services/auditLog');

// GET /api/admin/sellers — platform only. Example route proving the
// requirePlatform lock; real filtering/pagination belongs to the parked
// Seller Admin dashboard work, not Milestone 0.
const listSellers = async (req, res) => {
  const sellers = await Seller.find({}).sort({ createdAt: -1 });
  res.json({ sellers });
};

// PATCH /api/admin/sellers/:id/status — platform only. The one real
// mutating admin action in Milestone 0, specifically so there's something
// genuine for the audit log to record (the brief's example routes are all
// reads) — Milestone 1A's seller-detail status actions will supersede
// this with proper transition rules (approve/suspend/reactivate/close
// with required reasons); this is intentionally the bare-minimum version.
const SELLER_STATUSES = ['in_review', 'active', 'suspended', 'closed'];

const updateSellerStatus = async (req, res) => {
  const { status } = req.body;
  const seller = await Seller.findById(req.params.id);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const before = seller.status;
  seller.status = status;
  await seller.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'seller.status.update',
    targetType: 'Seller',
    targetId: seller._id,
    before: { status: before },
    after: { status: seller.status },
    summary: `Set ${seller.name}'s status to "${status}"`,
  });

  res.json({ seller });
};

module.exports = { listSellers, updateSellerStatus, SELLER_STATUSES };
