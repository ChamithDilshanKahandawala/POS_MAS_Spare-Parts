const Seller = require('../models/Seller');
const User = require('../models/User');
const SellerApplication = require('../models/SellerApplication');
const AuditLog = require('../models/AuditLog');
const Category = require('../models/Category');
const Listing = require('../models/Listing');
const { getColomboMidnightUTC } = require('../utils/colomboDate');

// GET /api/admin/overview — every number here is a real query, nothing
// fabricated. Orders/sales/commission are "—" (not zero — zero would
// falsely imply there's real data to report) until their milestones
// exist.
const getOverview = async (req, res) => {
  const [activeSellers, pendingSellers, suspendedSellers, pendingApplications, platformStaffCount, zeroCommissionCategories, listingsAwaitingReview] = await Promise.all([
    Seller.countDocuments({ status: 'active' }),
    Seller.countDocuments({ status: 'in_review' }),
    Seller.countDocuments({ status: 'suspended' }),
    SellerApplication.countDocuments({ status: { $in: ['new', 'info_requested'] } }),
    User.countDocuments({ platformRole: { $in: ['platform_owner', 'platform_staff'] } }),
    Category.countDocuments({ active: true, commissionRateBps: 0 }),
    Listing.countDocuments({ $or: [{ status: 'in_review' }, { 'pendingRevision.fields': { $ne: null } }] }),
  ]);

  const todayStart = getColomboMidnightUTC(new Date());
  const adminActionsToday = await AuditLog.countDocuments({ createdAt: { $gte: todayStart } });

  const needsAttention = await SellerApplication.find({ status: { $in: ['new', 'info_requested'] } })
    .sort({ createdAt: 1 })
    .limit(10)
    .select('storeName status createdAt')
    .lean();

  res.json({
    activeSellers,
    pendingSellers,
    suspendedSellers,
    pendingApplications,
    platformStaffCount,
    adminActionsToday,
    needsAttention,
    zeroCommissionCategories,
    listingsAwaitingReview,
    // Deliberately not real numbers — see the comment above.
    ordersTotal: null,
    salesTotal: null,
    commissionTotal: null,
  });
};

module.exports = { getOverview };
