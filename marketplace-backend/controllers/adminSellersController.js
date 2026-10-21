const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logAction } = require('../services/auditLog');
const { signViewAsToken } = require('../services/tokens');
const { clampLimit } = require('../utils/pagination');
const { notify } = require('../services/notifications');

const MAX_SELLERS_LIMIT = 100;

// Shared by the status-transition and bank-decision notifiers below —
// every active owner/staff member of a seller, so a notification reaches
// whoever's actually running the store, not just the owner.
async function notifyStoreMembers(sellerId, { type, title, body, link }) {
  const members = await SellerMember.find({ seller: sellerId, status: 'active' }).select('user').lean();
  await Promise.all(members.map((m) => notify({ userId: m.user, type, title, body, link })));
}

// GET /api/admin/sellers — search (name/BR/phone), filter by status,
// sort, server-side pagination.
const listSellers = async (req, res) => {
  const { search, status, sort = '-createdAt', page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = status;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { brNumber: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
    ];
  }

  const safeLimit = clampLimit(limit, 20, MAX_SELLERS_LIMIT);
  const sortObj = {};
  const sortField = sort.replace(/^-/, '');
  sortObj[sortField] = sort.startsWith('-') ? -1 : 1;

  const [sellers, total] = await Promise.all([
    Seller.find(query).sort(sortObj).skip((page - 1) * safeLimit).limit(safeLimit).lean(),
    Seller.countDocuments(query),
  ]);

  // Owner name per row, without an N+1 query per seller.
  const sellerIds = sellers.map((s) => s._id);
  const owners = await SellerMember.find({ seller: { $in: sellerIds }, role: 'seller_owner', status: 'active' }).populate('user', 'name email').lean();
  const ownerBySellerId = {};
  for (const o of owners) ownerBySellerId[o.seller.toString()] = o.user;

  res.json({
    sellers: sellers.map((s) => ({ ...s, owner: ownerBySellerId[s._id.toString()] || null })),
    total,
    page: Number(page),
    pages: Math.ceil(total / safeLimit),
  });
};

// GET /api/admin/sellers/:id — profile + members + (Activity tab) recent audit entries.
const getSellerDetail = async (req, res) => {
  const seller = await Seller.findById(req.params.id).lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const members = await SellerMember.find({ seller: seller._id, status: 'active' }).populate('user', 'name email isActive').lean();
  const recentActivity = await AuditLog.find({ targetType: 'Seller', targetId: seller._id.toString() }).sort({ createdAt: -1 }).limit(20).lean();

  res.json({ seller, members, recentActivity });
};

// PATCH /api/admin/sellers/:id/status — real transition rules. Only the
// transitions below are ever allowed; anything else (including the
// current status itself) is a 409 and changes nothing.
const TRANSITIONS = {
  approve: { from: ['in_review'], to: 'active' },
  suspend: { from: ['active'], to: 'suspended' },
  reactivate: { from: ['suspended'], to: 'active' },
  close: { from: ['active', 'suspended'], to: 'closed' },
};

const updateSellerStatus = async (req, res) => {
  const { action, reason } = req.body;
  const transition = TRANSITIONS[action];

  const seller = await Seller.findById(req.params.id);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  if (!transition.from.includes(seller.status)) {
    return res.status(409).json({
      message: `Cannot ${action}: seller is "${seller.status}", not one of [${transition.from.join(', ')}].`,
    });
  }

  const before = seller.status;
  seller.status = transition.to;
  await seller.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: `seller.status.${action}`,
    targetType: 'Seller',
    targetId: seller._id,
    before: { status: before },
    after: { status: seller.status },
    summary: `${action[0].toUpperCase()}${action.slice(1)}d ${seller.name}: ${before} → ${seller.status}. Reason: ${reason}`,
  });

  if (action === 'suspend' || action === 'reactivate') {
    await notifyStoreMembers(seller._id, {
      type: action === 'suspend' ? 'seller.suspended' : 'seller.reactivated',
      title: action === 'suspend' ? `${seller.name} has been suspended` : `${seller.name} is active again`,
      body: reason,
      link: '/seller',
    });
  }

  res.json({ seller });
};

// PATCH /api/admin/sellers/:id/overrides — owner only. Commission % and/
// or probation date; reason required whenever either actually changes.
const updateSellerOverrides = async (req, res) => {
  const { commissionOverridePct, probationUntil, reviewExempt, reason } = req.body;
  const seller = await Seller.findById(req.params.id);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const before = { commissionOverridePct: seller.commissionOverridePct, probationUntil: seller.probationUntil, reviewExempt: seller.reviewExempt };
  let changed = false;

  if (commissionOverridePct !== undefined && commissionOverridePct !== seller.commissionOverridePct) {
    seller.commissionOverridePct = commissionOverridePct;
    changed = true;
  }
  if (probationUntil !== undefined) {
    const newVal = probationUntil === null ? null : new Date(probationUntil);
    const changedProbation = (newVal?.getTime() ?? null) !== (seller.probationUntil?.getTime() ?? null);
    if (changedProbation) {
      seller.probationUntil = newVal;
      changed = true;
    }
  }
  if (reviewExempt !== undefined && reviewExempt !== seller.reviewExempt) {
    seller.reviewExempt = reviewExempt;
    changed = true;
  }

  if (!changed) return res.json({ seller }); // no-op, nothing to audit

  await seller.save();
  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'seller.overrides.update',
    targetType: 'Seller',
    targetId: seller._id,
    before,
    after: { commissionOverridePct: seller.commissionOverridePct, probationUntil: seller.probationUntil, reviewExempt: seller.reviewExempt },
    summary: `Updated overrides for ${seller.name}. Reason: ${reason}`,
  });

  res.json({ seller });
};

// POST /api/admin/sellers/:id/view-as — issues a short-lived read-only
// token scoped to this one seller. Every write route under /api/seller/*
// rejects it (middleware/authMiddleware.js's requireSellerMember).
const viewAsSeller = async (req, res) => {
  const seller = await Seller.findById(req.params.id).lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const token = signViewAsToken(req.user, seller._id);

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'seller.view_as.start',
    targetType: 'Seller',
    targetId: seller._id,
    summary: `${req.user.name} started viewing ${seller.name} read-only`,
  });

  res.json({ token, seller: { id: seller._id, name: seller.name } });
};

// GET /api/admin/sellers/:id/bank — the one place the FULL account
// number is ever returned (explicitly re-selected past the schema's
// select:false). Every call is audited — viewing it is a sensitive
// action in its own right, not just changing it.
const getSellerBank = async (req, res) => {
  // A single select() call: mixing an inclusive 'name bankAccount' list
  // with a '+bankAccount.accountNumber' addition across two chained
  // select() calls causes Mongoose/MongoDB's "Path collision" error —
  // '+path' alone is enough (default projection already includes
  // everything except accountNumber; '+' just un-hides that one field).
  const seller = await Seller.findById(req.params.id).select('+bankAccount.accountNumber').lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'seller.bank.view_full',
    targetType: 'Seller',
    targetId: seller._id,
    summary: `${req.user.name} viewed ${seller.name}'s full bank account number`,
  });

  res.json({ bankAccount: seller.bankAccount });
};

// PATCH /api/admin/sellers/:id/bank/verify
const verifySellerBank = async (req, res) => {
  const seller = await Seller.findById(req.params.id);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });
  if (seller.bankAccount.status !== 'pending') {
    return res.status(409).json({ message: `Cannot verify: bank account is "${seller.bankAccount.status}", not "pending".` });
  }

  seller.bankAccount.status = 'verified';
  seller.bankAccount.verifiedAt = new Date();
  seller.bankAccount.rejectedReason = '';
  await seller.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'seller.bank.verify',
    targetType: 'Seller',
    targetId: seller._id,
    summary: `${req.user.name} verified ${seller.name}'s bank account`,
  });

  await notifyStoreMembers(seller._id, {
    type: 'bank.verified',
    title: 'Your bank account was verified',
    body: `${seller.name}'s bank account has been verified.`,
    link: '/seller/bank',
  });

  res.json({ seller });
};

// PATCH /api/admin/sellers/:id/bank/reject
const rejectSellerBank = async (req, res) => {
  const { reason } = req.body;
  const seller = await Seller.findById(req.params.id);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });
  if (seller.bankAccount.status !== 'pending') {
    return res.status(409).json({ message: `Cannot reject: bank account is "${seller.bankAccount.status}", not "pending".` });
  }

  seller.bankAccount.status = 'rejected';
  seller.bankAccount.rejectedReason = reason;
  await seller.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'seller.bank.reject',
    targetType: 'Seller',
    targetId: seller._id,
    summary: `${req.user.name} rejected ${seller.name}'s bank account: ${reason}`,
  });

  await notifyStoreMembers(seller._id, {
    type: 'bank.rejected',
    title: 'Your bank account needs attention',
    body: reason,
    link: '/seller/bank',
  });

  res.json({ seller });
};

module.exports = {
  listSellers,
  getSellerDetail,
  updateSellerStatus,
  updateSellerOverrides,
  viewAsSeller,
  getSellerBank,
  verifySellerBank,
  rejectSellerBank,
  TRANSITIONS,
};
