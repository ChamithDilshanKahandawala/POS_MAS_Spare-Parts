const User = require('../models/User');
const Order = require('../models/Order');
const SellerOrder = require('../models/SellerOrder');
const ReturnRequest = require('../models/ReturnRequest');
const SellerMember = require('../models/SellerMember');
const { logAction } = require('../services/auditLog');
const { sendPasswordResetLink } = require('../services/passwordReset');
const { clampLimit } = require('../utils/pagination');

// Admin → Customers. A customer is any account without a platform role
// (sellers who also shop show up too, flagged). Phones and street lines are
// masked here: support identifies the person, it doesn't read their address.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const maskPhone = (p) => (p ? `${p.slice(0, 5)}***${p.slice(-2)}` : '');
const maskLine = (l) => (l ? `${l.slice(0, 3)}***` : '');

function publicCustomer(u) {
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    phone: maskPhone(u.phone),
    preferredLanguage: u.preferredLanguage,
    isActive: u.isActive,
    deactivatedAt: u.deactivatedAt,
    deactivationReason: u.deactivationReason,
    createdAt: u.createdAt,
  };
}

// GET /api/admin/customers?q=&status=active|deactivated&page=
const listCustomers = async (req, res) => {
  const { q, status, page = 1, limit } = req.query;
  const filter = { platformRole: 'none' };
  if (status) filter.isActive = status === 'active';
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const safeLimit = clampLimit(limit, 20, 100);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit)
      .select('name email phone preferredLanguage isActive deactivatedAt deactivationReason createdAt').lean(),
    User.countDocuments(filter),
  ]);
  const ids = users.map((u) => u._id);
  const [orderStats, sellerUsers] = await Promise.all([
    Order.aggregate([
      { $match: { customer: { $in: ids } } },
      { $group: { _id: '$customer', orderCount: { $sum: 1 }, lastOrderAt: { $max: '$createdAt' } } },
    ]),
    SellerMember.distinct('user', { user: { $in: ids }, status: 'active' }),
  ]);
  const statsBy = Object.fromEntries(orderStats.map((s) => [String(s._id), s]));
  const sellerSet = new Set(sellerUsers.map(String));
  res.json({
    customers: users.map((u) => ({
      ...publicCustomer(u),
      orderCount: statsBy[String(u._id)]?.orderCount || 0,
      lastOrderAt: statsBy[String(u._id)]?.lastOrderAt || null,
      isSellerMember: sellerSet.has(String(u._id)),
    })),
    total, page: Number(page), limit: safeLimit,
  });
};

async function findCustomer(id) {
  return User.findOne({ _id: id, platformRole: 'none' });
}

// GET /api/admin/customers/:id
const getCustomer = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, platformRole: 'none' })
    .select('name email phone preferredLanguage isActive deactivatedAt deactivationReason createdAt addresses').lean();
  if (!user) return res.status(404).json({ message: 'Customer not found' });

  const [orders, parcels, returns, orderTotals, isSellerMember] = await Promise.all([
    Order.find({ customer: user._id }).sort({ createdAt: -1 }).limit(20).select('orderNumber grandTotalCents createdAt sellerOrders').lean(),
    SellerOrder.find({ customer: user._id }).sort({ createdAt: -1 }).limit(100).select('order orderNumber status seller').populate('seller', 'name').lean(),
    ReturnRequest.find({ customer: user._id }).sort({ createdAt: -1 }).limit(20).select('requestNumber orderNumber status reason refundItemsCents createdAt').lean(),
    Order.aggregate([{ $match: { customer: user._id } }, { $group: { _id: null, count: { $sum: 1 }, totalCents: { $sum: '$grandTotalCents' } } }]),
    SellerMember.exists({ user: user._id, status: 'active' }),
  ]);
  const parcelsByOrder = {};
  for (const p of parcels) (parcelsByOrder[String(p.order)] ||= []).push({ orderNumber: p.orderNumber, status: p.status, seller: p.seller?.name || '' });

  res.json({
    customer: {
      ...publicCustomer(user),
      isSellerMember: !!isSellerMember,
      addresses: (user.addresses || []).map((a) => ({ _id: a._id, label: a.label, line1: maskLine(a.line1), city: a.city, district: a.district, phone: maskPhone(a.phone), isDefault: a.isDefault })),
    },
    stats: { orderCount: orderTotals[0]?.count || 0, totalCents: orderTotals[0]?.totalCents || 0, returnCount: returns.length },
    orders: orders.map((o) => ({ _id: o._id, orderNumber: o.orderNumber, grandTotalCents: o.grandTotalCents, createdAt: o.createdAt, parcels: parcelsByOrder[String(o._id)] || [] })),
    returns,
  });
};

// POST /api/admin/customers/:id/deactivate { reason } — takes effect on the
// next request (requireAuth checks isActive) and ends any refresh session.
const deactivateCustomer = async (req, res) => {
  const user = await findCustomer(req.params.id);
  if (!user) return res.status(404).json({ message: 'Customer not found' });
  if (!user.isActive) return res.status(409).json({ message: 'This account is already deactivated' });

  user.isActive = false;
  user.deactivatedAt = new Date();
  user.deactivationReason = req.body.reason;
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'customer.deactivate',
    targetType: 'User', targetId: user._id,
    before: { isActive: true }, after: { isActive: false, reason: req.body.reason },
    summary: `Deactivated customer ${user.email}: ${req.body.reason}`,
  });
  res.json({ customer: publicCustomer(user) });
};

// POST /api/admin/customers/:id/reactivate { reason }
const reactivateCustomer = async (req, res) => {
  const user = await findCustomer(req.params.id);
  if (!user) return res.status(404).json({ message: 'Customer not found' });
  if (user.isActive) return res.status(409).json({ message: 'This account is already active' });

  const previousReason = user.deactivationReason;
  user.isActive = true;
  user.deactivatedAt = null;
  user.deactivationReason = '';
  await user.save();

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'customer.reactivate',
    targetType: 'User', targetId: user._id,
    before: { isActive: false, reason: previousReason }, after: { isActive: true, reason: req.body.reason },
    summary: `Reactivated customer ${user.email}: ${req.body.reason}`,
  });
  res.json({ customer: publicCustomer(user) });
};

// POST /api/admin/customers/:id/send-password-reset — emails the customer a
// reset link. Staff never see or set the password.
const sendCustomerPasswordReset = async (req, res) => {
  const user = await findCustomer(req.params.id);
  if (!user) return res.status(404).json({ message: 'Customer not found' });
  if (!user.isActive) return res.status(409).json({ message: 'Reactivate the account before sending a reset link' });

  const token = await sendPasswordResetLink(user);
  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'customer.password_reset_sent',
    targetType: 'User', targetId: user._id,
    summary: `Sent a password reset link to ${user.email}`,
  });
  const response = { message: 'Reset link sent' };
  if (process.env.NODE_ENV === 'test') response.debugResetToken = token;
  res.json(response);
};

module.exports = { listCustomers, getCustomer, deactivateCustomer, reactivateCustomer, sendCustomerPasswordReset };
