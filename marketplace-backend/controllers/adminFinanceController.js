const LedgerEntry = require('../models/LedgerEntry');
const SellerOrder = require('../models/SellerOrder');
const Seller = require('../models/Seller');
const { logAction } = require('../services/auditLog');
const { listCodNotReceived } = require('../services/remittance');
const { getPlatformSettings } = require('../services/platformSettings');

function startOfWeek(now) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
function startOfMonth(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

// GET /api/admin/finance/overview — Part E.
const getOverview = async (req, res) => {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const settings = await getPlatformSettings();

  const [commissionWeek, commissionMonth, bySellerMonth, codOutstandingCount, payoutsDueAgg, refundsNeeded] = await Promise.all([
    LedgerEntry.aggregate([
      { $match: { type: 'commission', createdAt: { $gte: weekStart } } },
      { $group: { _id: null, total: { $sum: '$amountCents' } } },
    ]),
    LedgerEntry.aggregate([
      { $match: { type: 'commission', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amountCents' } } },
    ]),
    LedgerEntry.aggregate([
      { $match: { type: 'commission', createdAt: { $gte: monthStart } } },
      { $group: { _id: '$seller', commissionCents: { $sum: '$amountCents' } } },
      { $sort: { commissionCents: 1 } },
      { $limit: 10 },
      { $lookup: { from: 'sellers', localField: '_id', foreignField: '_id', as: 'seller' } },
      { $unwind: '$seller' },
      { $project: { _id: 0, sellerId: '$_id', sellerName: { $ifNull: ['$seller.displayName', '$seller.name'] }, commissionCents: { $abs: '$commissionCents' } } },
    ]),
    listCodNotReceived(settings.codNotReceivedAfterDays).then((rows) => rows.length),
    LedgerEntry.aggregate([
      { $match: { status: 'payable' } },
      { $group: { _id: '$seller', balance: { $sum: '$amountCents' } } },
      { $match: { balance: { $gte: settings.minimumPayoutCents } } },
      { $count: 'count' },
    ]),
    SellerOrder.countDocuments({ refundNeeded: true }),
  ]);

  const commissionByCategory = await LedgerEntry.aggregate([
    { $match: { type: 'commission', createdAt: { $gte: monthStart } } },
    { $lookup: { from: 'sellerorders', localField: 'sellerOrder', foreignField: '_id', as: 'order' } },
    { $unwind: '$order' },
    { $unwind: '$order.items' },
    {
      $project: {
        commissionShare: {
          $multiply: [
            { $abs: '$amountCents' },
            { $cond: [{ $eq: ['$order.itemsTotalCents', 0] }, 0, { $divide: ['$order.items.lineTotalCents', '$order.itemsTotalCents'] }] },
          ],
        },
        listing: '$order.items.listing',
      },
    },
    { $lookup: { from: 'listings', localField: 'listing', foreignField: '_id', as: 'listingDoc' } },
    { $unwind: { path: '$listingDoc', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$listingDoc.categoryId', commissionCents: { $sum: '$commissionShare' } } },
    { $match: { _id: { $ne: null } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, categoryId: '$_id', categoryName: '$category.name', commissionCents: { $round: ['$commissionCents', 0] } } },
    { $sort: { commissionCents: -1 } },
    { $limit: 10 },
  ]);

  res.json({
    commissionEarnedWeekCents: Math.abs(commissionWeek[0]?.total || 0),
    commissionEarnedMonthCents: Math.abs(commissionMonth[0]?.total || 0),
    commissionBySeller: bySellerMonth,
    commissionByCategory,
    codOutstandingCount,
    payoutsDueCount: payoutsDueAgg[0]?.count || 0,
    refundsNeeded,
  });
};

// GET /api/admin/finance/sellers — Part E's seller balances table.
const listSellerBalances = async (req, res) => {
  const balances = await LedgerEntry.aggregate([
    {
      $group: {
        _id: { seller: '$seller', status: '$status' },
        total: { $sum: '$amountCents' },
      },
    },
    {
      $group: {
        _id: '$_id.seller',
        byStatus: { $push: { status: '$_id.status', total: '$total' } },
      },
    },
    { $lookup: { from: 'sellers', localField: '_id', foreignField: '_id', as: 'seller' } },
    { $unwind: '$seller' },
    {
      $project: {
        _id: 0,
        sellerId: '$_id',
        sellerName: { $ifNull: ['$seller.displayName', '$seller.name'] },
        settlementMode: '$seller.settlementMode',
        byStatus: 1,
      },
    },
    { $sort: { sellerName: 1 } },
  ]);

  const shaped = balances.map((b) => {
    const get = (status) => b.byStatus.find((s) => s.status === status)?.total || 0;
    return {
      sellerId: b.sellerId,
      sellerName: b.sellerName,
      settlementMode: b.settlementMode,
      onHoldCents: get('on_hold'),
      payableCents: get('payable'),
      inPayoutCents: get('in_payout'),
      paidCents: get('paid'),
    };
  });

  res.json({ sellers: shaped });
};

// GET /api/admin/finance/cod-not-received — Part E/B.2.
const getCodNotReceived = async (req, res) => {
  const settings = await getPlatformSettings();
  const rows = await listCodNotReceived(settings.codNotReceivedAfterDays);
  res.json({ orders: rows, afterDays: settings.codNotReceivedAfterDays });
};

// POST /api/admin/finance/sellers/:id/adjustments — Part A.4. Owner-only,
// requires a fresh step-up (route-level middleware), reason required,
// audited, visible to the seller through the same ledger list every
// other entry shows up in.
const createAdjustment = async (req, res) => {
  const { amountCents, reason } = req.body;
  const seller = await Seller.findById(req.params.id).select('name displayName').lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const entry = await LedgerEntry.create({
    seller: seller._id,
    type: 'adjustment',
    amountCents,
    status: 'payable',
    availableAt: new Date(),
    reason,
    createdBy: req.user._id,
  });

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.adjustment.create',
    targetType: 'Seller', targetId: seller._id,
    after: { amountCents, reason },
    summary: `${req.user.name} created a ${amountCents >= 0 ? '+' : ''}${(amountCents / 100).toFixed(2)} adjustment for ${seller.displayName || seller.name}: ${reason}`,
  });

  res.status(201).json({ entry });
};

// PATCH /api/admin/finance/sellers/:id/settlement-mode — Part A.5.
// Owner-only, audited.
const updateSettlementMode = async (req, res) => {
  const { settlementMode } = req.body;
  const seller = await Seller.findById(req.params.id);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const before = seller.settlementMode;
  seller.settlementMode = settlementMode;
  await seller.save();

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'seller.settlement_mode.update',
    targetType: 'Seller', targetId: seller._id,
    before: { settlementMode: before }, after: { settlementMode },
    summary: `${req.user.name} changed ${seller.displayName || seller.name}'s settlement mode from "${before}" to "${settlementMode}"`,
  });

  res.json({ settlementMode: seller.settlementMode });
};

// GET /api/admin/finance/sellers/:id/ledger — the admin-side per-seller
// drill-down (SellerDetailPage's Finance tab).
const getSellerLedger = async (req, res) => {
  const { type, status, from, to, page = 1, limit = 50 } = req.query;
  const filter = { seller: req.params.id };
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(200, Math.max(1, Number(limit)));

  const [entries, total] = await Promise.all([
    LedgerEntry.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    LedgerEntry.countDocuments(filter),
  ]);

  res.json({ entries, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
};

module.exports = {
  getOverview, listSellerBalances, getCodNotReceived, createAdjustment, updateSettlementMode, getSellerLedger,
};
