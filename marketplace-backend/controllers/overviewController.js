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
  const todayStart = getColomboMidnightUTC(new Date());

  // One round trip: every query runs concurrently (each costs a full DB
  // round trip, so sequential awaits multiply latency).
  const [sellerCounts, pendingApplications, platformStaffCount, zeroCommissionCategories, listingsAwaitingReview, adminActionsToday, needsAttention] = await Promise.all([
    Seller.aggregate([
      { $match: { status: { $in: ['active', 'in_review', 'suspended'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    SellerApplication.countDocuments({ status: { $in: ['new', 'info_requested'] } }),
    User.countDocuments({ platformRole: { $in: ['platform_owner', 'platform_staff'] } }),
    Category.countDocuments({ active: true, commissionRateBps: 0 }),
    Listing.countDocuments({ $or: [{ status: 'in_review' }, { 'pendingRevision.fields': { $ne: null } }] }),
    AuditLog.countDocuments({ createdAt: { $gte: todayStart } }),
    SellerApplication.find({ status: { $in: ['new', 'info_requested'] } })
      .sort({ createdAt: 1 })
      .limit(10)
      .select('storeName status createdAt')
      .lean(),
  ]);
  const bySellerStatus = Object.fromEntries(sellerCounts.map((r) => [r._id, r.count]));

  res.json({
    activeSellers: bySellerStatus.active || 0,
    pendingSellers: bySellerStatus.in_review || 0,
    suspendedSellers: bySellerStatus.suspended || 0,
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
