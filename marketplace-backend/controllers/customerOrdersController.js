// Milestone 6 Part C — "My orders" in marketplace mode. Every route here
// scopes strictly to req.user._id, same reasoning as customerController.js —
// a customer id is never taken from the client, only from the auth token.
const Order = require('../models/Order');
const SellerOrder = require('../models/SellerOrder');
const { CUSTOMER_CANCELLABLE_STATUSES } = require('../models/SellerOrder');
const { release } = require('../services/stockReservation');
const { notify } = require('../services/notifications');
const SellerMember = require('../models/SellerMember');

// GET /api/customer/orders
const listMyOrders = async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 }).lean();
  const sellerOrders = await SellerOrder.find({ customer: req.user._id }).lean();
  const byOrder = new Map();
  for (const so of sellerOrders) {
    const key = String(so.order);
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key).push(so);
  }
  res.json({ orders: orders.map((o) => ({ ...o, sellerOrders: byOrder.get(String(o._id)) || [] })) });
};

// GET /api/customer/orders/:orderNumber — orderNumber, not a Mongo id,
// since that's what the order-success page and every link use.
const getMyOrder = async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, customer: req.user._id }).lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const sellerOrders = await SellerOrder.find({ order: order._id }).populate('seller', 'name displayName slug').lean();
  res.json({ order, sellerOrders });
};

// POST /api/customer/orders/:orderNumber/cancel — cancels every parcel at
// once, only while ALL of them are still New or Confirmed (the spec's
// literal wording) — a customer can't partially cancel an order one
// seller has already started packing while leaving the rest.
const cancelMyOrder = async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, customer: req.user._id });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const sellerOrders = await SellerOrder.find({ order: order._id });
  const notCancellable = sellerOrders.filter((so) => !CUSTOMER_CANCELLABLE_STATUSES.includes(so.status));
  if (notCancellable.length) {
    return res.status(409).json({
      message: 'This order can no longer be fully cancelled — one or more sellers have already started preparing it.',
    });
  }

  for (const so of sellerOrders) {
    const from = so.status;
    so.status = 'cancelled';
    so.cancelReason = req.body.reason || 'Cancelled by customer';
    so.cancelledAt = new Date();
    so.autoCancelAt = null;
    // Follow-up — forward guard for Milestone 7: every order today is
    // COD, so this never actually fires yet; see the identical check in
    // sellerOrdersController.js's cancelled branch.
    if (so.paymentMethod !== 'cod') so.refundNeeded = true;
    so.statusHistory.push({ from, to: 'cancelled', by: req.user._id, reason: so.cancelReason, at: new Date() });
    for (const item of so.items) {
      if (item.reservationStatus === 'active') {
        await release(item.listing, item.qty);
        item.reservationStatus = 'released';
      }
    }
    await so.save();

    const owner = await SellerMember.findOne({ seller: so.seller, role: 'seller_owner', status: 'active' }).select('user').lean();
    if (owner) {
      await notify({
        userId: owner.user,
        type: 'order.cancelled',
        title: `Order ${so.orderNumber} was cancelled by the customer`,
        link: '/seller/orders',
      });
    }
  }

  res.json({ message: 'Order cancelled' });
};

module.exports = { listMyOrders, getMyOrder, cancelMyOrder };
