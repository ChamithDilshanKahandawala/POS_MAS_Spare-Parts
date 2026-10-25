// Milestone 6 Part F — Admin order oversight across every seller. Unlike
// Seller Center, there's no req.sellerId scoping here — requirePlatform
// (routes/adminRoutes.js) is the only gate, and every mutating action is
// audited (services/auditLog.js), same discipline as every other
// admin-level write in this project.
const SellerOrder = require('../models/SellerOrder');
const Seller = require('../models/Seller');
const { STATUSES } = require('../models/SellerOrder');
const { release } = require('../services/stockReservation');
const { notify } = require('../services/notifications');
const { logAction } = require('../services/auditLog');
const SellerMember = require('../models/SellerMember');
const { postDeliveryLedgerEntries } = require('../services/ledger');

// GET /api/admin/orders — filters: seller, status, date range, district,
// search by order number, refundNeeded (follow-up #2).
const listOrders = async (req, res) => {
  const { seller, status, from, to, district, search, page = 1, limit = 20, refundNeeded } = req.query;
  const filter = {};
  if (seller) filter.seller = seller;
  if (status) filter.status = status === 'cancelled' ? { $in: ['cancelled', 'delivery_failed', 'returned'] } : status;
  if (district) filter['shippingAddress.district'] = district;
  if (search) filter.orderNumber = { $regex: search, $options: 'i' };
  if (refundNeeded === 'true') filter.refundNeeded = true;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const safeLimit = Math.min(Number(limit) || 20, 100);
  const [orders, total] = await Promise.all([
    SellerOrder.find(filter).sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit)
      .populate('seller', 'name displayName').populate('customer', 'name email').lean(),
    SellerOrder.countDocuments(filter),
  ]);

  res.json({ orders, total, page: Number(page), pages: Math.ceil(total / safeLimit) });
};

// GET /api/admin/orders/:id
const getOrderDetail = async (req, res) => {
  const order = await SellerOrder.findById(req.params.id)
    .populate('seller', 'name displayName slug').populate('customer', 'name email phone').lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json({ order });
};

// GET /api/admin/orders-overview — Part F: orders today, waiting for
// confirmation, delivery failures, refunds needed (follow-up #2).
const getOrdersOverview = async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [ordersToday, waitingConfirmation, deliveryFailures, refundsNeeded] = await Promise.all([
    SellerOrder.countDocuments({ createdAt: { $gte: startOfToday } }),
    SellerOrder.countDocuments({ status: 'new' }),
    SellerOrder.countDocuments({ status: 'delivery_failed' }),
    SellerOrder.countDocuments({ refundNeeded: true }),
  ]);

  res.json({ ordersToday, waitingConfirmation, deliveryFailures, refundsNeeded });
};

// POST /api/admin/orders/:id/cancel — reason required, audited. Allowed
// from any pre-shipped state, same boundary as the seller's own cancel.
const cancelOrder = async (req, res) => {
  const order = await SellerOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (!['new', 'confirmed', 'packed'].includes(order.status)) {
    return res.status(409).json({ message: `Cannot cancel: order is "${order.status}".` });
  }

  const before = { status: order.status };
  order.statusHistory.push({ from: order.status, to: 'cancelled', by: req.user._id, reason: req.body.reason, at: new Date() });
  order.status = 'cancelled';
  order.cancelReason = req.body.reason;
  order.cancelledAt = new Date();
  order.autoCancelAt = null;
  // Follow-up — forward guard for Milestone 7: every order today is COD,
  // so this never actually fires yet; see the identical check in
  // sellerOrdersController.js's cancelled branch.
  if (order.paymentMethod !== 'cod') order.refundNeeded = true;
  for (const item of order.items) {
    if (item.reservationStatus === 'active') {
      await release(item.listing, item.qty);
      item.reservationStatus = 'released';
    }
  }
  await order.save();

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'order.cancel',
    targetType: 'SellerOrder', targetId: order._id, before, after: { status: order.status, reason: req.body.reason },
    summary: `Cancelled order ${order.orderNumber}: ${req.body.reason}`,
  });

  const owner = await SellerMember.findOne({ seller: order.seller, role: 'seller_owner', status: 'active' }).select('user').lean();
  await Promise.all([
    notify({ userId: order.customer, type: 'order.cancelled', title: `Order ${order.orderNumber} was cancelled`, body: req.body.reason, link: '/orders' }),
    ...(owner ? [notify({ userId: owner.user, type: 'order.cancelled', title: `Order ${order.orderNumber} was cancelled by Apexora`, body: req.body.reason, link: '/seller/orders' })] : []),
  ]);

  res.json({ order: order.toObject() });
};

// POST /api/admin/orders/:id/move-on — force an otherwise-blocked
// transition forward with a reason, audited. Bypasses the seller's
// normal TRANSITIONS table (that's the whole point — "a stuck parcel"),
// but never moves a terminal order (cancelled/delivered/delivery_failed)
// anywhere, and never skips backwards.
const FORWARD_ORDER = ['new', 'confirmed', 'packed', 'shipped', 'delivered'];
const moveOrderOn = async (req, res) => {
  const { toStatus, reason } = req.body;
  const order = await SellerOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const fromIdx = FORWARD_ORDER.indexOf(order.status);
  const toIdx = FORWARD_ORDER.indexOf(toStatus);
  if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) {
    return res.status(409).json({ message: `Cannot move "${order.status}" forward to "${toStatus}".` });
  }

  const before = { status: order.status };
  order.statusHistory.push({ from: order.status, to: toStatus, by: req.user._id, reason: `Admin override: ${reason}`, at: new Date() });
  order.status = toStatus;
  if (toStatus === 'confirmed') order.confirmedAt = new Date();
  if (toStatus === 'packed') order.packedAt = new Date();
  if (toStatus === 'shipped') order.shippedAt = new Date();
  if (toStatus === 'delivered') order.deliveredAt = new Date();
  await order.save();

  // Milestone 7 Part A.2 — same hook as the seller-driven 'deliver'
  // transition (controllers/sellerOrdersController.js) — an admin
  // force-moving a stuck parcel to 'delivered' must post the ledger
  // entries too, not just the normal seller flow.
  if (toStatus === 'delivered') await postDeliveryLedgerEntries(order._id);

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'order.move_on',
    targetType: 'SellerOrder', targetId: order._id, before, after: { status: order.status },
    summary: `Force-moved order ${order.orderNumber} from "${before.status}" to "${toStatus}": ${reason}`,
  });

  res.json({ order: order.toObject() });
};

// POST /api/admin/orders/:id/notes — internal, never seller/customer-visible.
const addInternalNote = async (req, res) => {
  const order = await SellerOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  order.internalNotes.push({ text: req.body.text, by: req.user._id, at: new Date() });
  await order.save();
  res.status(201).json({ internalNotes: order.internalNotes });
};

module.exports = { listOrders, getOrderDetail, getOrdersOverview, cancelOrder, moveOrderOn, addInternalNote, STATUSES };
