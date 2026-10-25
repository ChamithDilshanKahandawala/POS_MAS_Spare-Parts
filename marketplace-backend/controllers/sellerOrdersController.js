// Milestone 6 Part E — Seller Center order management. Every route sits
// behind requireAuth + requireSellerMember (routes/sellerRoutes.js),
// which sets req.sellerId from the caller's own membership — never a
// client-supplied seller id, same reasoning as every other seller route
// in this project. A seller only ever sees SellerOrder rows where
// `seller === req.sellerId`; findOne (not find) below means another
// seller's order id just 404s, same as "not a member" elsewhere.
const mongoose = require('mongoose');
const SellerOrder = require('../models/SellerOrder');
const Seller = require('../models/Seller');
const { consume, release, restock } = require('../services/stockReservation');
const { notify } = require('../services/notifications');
const { logAction } = require('../services/auditLog');
const { postDeliveryLedgerEntries } = require('../services/ledger');
const LedgerEntry = require('../models/LedgerEntry');
const { getPlatformSettings } = require('../services/platformSettings');

const MASK_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // Part E: 30 days after delivered/cancelled

// Customer phone/address are masked in the seller's own view once a
// parcel has been in a terminal state for 30+ days — a seller has no
// ongoing reason to keep a customer's contact details once the delivery
// (or its cancellation) is long settled. Computed at read time from the
// existing deliveredAt/cancelledAt timestamps, not a stored/batch-job
// mutation — always correct the moment the 30 days pass, never stale
// between job runs, and the real data is never destroyed (an admin's own
// view is unaffected by this).
function maskForSellerView(sellerOrder) {
  const settledAt = sellerOrder.deliveredAt || sellerOrder.cancelledAt;
  if (!settledAt || Date.now() - new Date(settledAt).getTime() < MASK_AFTER_MS) return sellerOrder;
  return {
    ...sellerOrder,
    shippingAddress: { ...sellerOrder.shippingAddress, line1: '•••', line2: '', landmark: '', phone: '•••••••••' },
  };
}

// GET /api/seller/orders — tabs + counts + search + date filter, plus
// the follow-up "Not yet recorded in POS" filter (notRecordedInPos=true):
// cross-cuts the Shipped/Delivered tabs rather than being its own tab, so
// it overrides whatever `status` was also sent.
// Matches both halves of "not yet recorded in POS" (Part E + follow-up
// #5): the original sale (Shipped/Delivered, posRecorded false) and a
// later return (Returned, returnPosRecorded false) — an order is only
// ever in one of those two states at once, so this is a plain $or, not
// two separate queries. Shared by listOrders' filter and its own count
// below, so those two can never disagree with each other. Deliberately
// NOT used by services/posRecordedReminder.js's sweep — that job adds
// its own 24h-since-the-event cutoff on top of this same shape (a
// seller should be able to see "not yet recorded" here the moment it
// ships, but shouldn't be NAGGED about it until it's actually been a
// day), so it keeps its own copy of these conditions with a date clause
// added, rather than extending this one with a parameter neither other
// caller needs.
function notRecordedInPosFilter() {
  return {
    $or: [
      { status: { $in: ['shipped', 'delivered'] }, posRecorded: false },
      { status: 'returned', returnPosRecorded: false },
    ],
  };
}

const listOrders = async (req, res) => {
  const { status, search, from, to, page = 1, limit = 20, notRecordedInPos } = req.query;
  const filter = { seller: req.sellerId };
  if (notRecordedInPos === 'true') {
    Object.assign(filter, notRecordedInPosFilter());
  } else if (status === 'cancelled') {
    filter.status = { $in: ['cancelled', 'delivery_failed', 'returned'] };
  } else if (status) {
    filter.status = status;
  }
  if (search) {
    filter.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
    ];
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const safeLimit = Math.min(Number(limit) || 20, 100);
  const [orders, total, counts] = await Promise.all([
    SellerOrder.find(filter).sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit).lean(),
    SellerOrder.countDocuments(filter),
    // Unlike find()/countDocuments() above, a raw aggregate() pipeline
    // does NOT auto-cast a query value against the schema type — $match
    // here needs a real ObjectId, not the plain string req.sellerId
    // (req.headers['x-seller-id'], set by requireSellerMember) actually
    // is, or this silently matches nothing and every tab shows "(0)"
    // regardless of how many orders actually exist.
    SellerOrder.aggregate([
      { $match: { seller: new mongoose.Types.ObjectId(req.sellerId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const countsByStatus = { new: 0, confirmed: 0, packed: 0, shipped: 0, delivered: 0, cancelled: 0 };
  for (const c of counts) {
    if (c._id === 'delivery_failed' || c._id === 'returned') countsByStatus.cancelled += c.count;
    else if (countsByStatus[c._id] !== undefined) countsByStatus[c._id] += c.count;
  }

  const notRecordedInPosCount = await SellerOrder.countDocuments({ seller: req.sellerId, ...notRecordedInPosFilter() });

  res.json({
    orders: orders.map(maskForSellerView),
    total, page: Number(page), pages: Math.ceil(total / safeLimit),
    counts: countsByStatus,
    notRecordedInPosCount,
  });
};

// GET /api/seller/orders/:id
const getOrderDetail = async (req, res) => {
  // Only the customer's name — never email, which delivery has no reason
  // to need (phone already lives in shippingAddress.phone, subject to
  // maskForSellerView same as the rest of the address).
  const order = await SellerOrder.findOne({ _id: req.params.id, seller: req.sellerId }).populate('customer', 'name').lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const seller = await Seller.findById(req.sellerId).select('posConnection.enabled').lean();
  res.json({ order: maskForSellerView(order), posConnected: !!seller?.posConnection?.enabled });
};

// Only these transitions are ever allowed from the Seller Center; anything
// else (including re-sending the current status) is a 409. Same shape as
// adminSellersController.js's own TRANSITIONS table.
const TRANSITIONS = {
  confirm: { from: ['new'], to: 'confirmed' },
  pack: { from: ['confirmed'], to: 'packed' },
  ship: { from: ['packed'], to: 'shipped' },
  deliver: { from: ['shipped'], to: 'delivered' },
  fail: { from: ['shipped'], to: 'delivery_failed' },
  cancel: { from: ['new', 'confirmed', 'packed'], to: 'cancelled' },
  // Follow-up — the step after a failed/refused delivery: the item is
  // physically back with the seller.
  return: { from: ['delivery_failed'], to: 'returned' },
};

// POST /api/seller/orders/:id/transition  { action, reason?, courier?, trackingNumber? }
const transitionOrder = async (req, res) => {
  const { action, reason, courier, trackingNumber } = req.body;

  // Follow-up — 'return' has its own handler: it needs an atomically
  // CONDITIONAL status change (only restock if the claim actually won),
  // which the generic read-then-save flow below can't guarantee under
  // two concurrent requests. See handleReturn's own comment.
  if (action === 'return') return handleReturn(req, res, reason);

  const transition = TRANSITIONS[action];

  const order = await SellerOrder.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (!transition.from.includes(order.status)) {
    return res.status(409).json({ message: `Cannot ${action}: order is "${order.status}", not one of [${transition.from.join(', ')}].` });
  }

  const from = order.status;
  order.status = transition.to;
  order.statusHistory.push({ from, to: transition.to, by: req.user._id, reason: reason || '', at: new Date() });

  if (transition.to === 'confirmed') order.confirmedAt = new Date();
  if (transition.to === 'packed') order.packedAt = new Date();
  if (transition.to === 'shipped') {
    order.shippedAt = new Date();
    order.courier = courier;
    order.trackingNumber = trackingNumber;

    // Part D: a non-POS seller's "mark shipped" turns the hold into a
    // real deduction. A POS-linked seller's items stay reserved — their
    // stock truth lives in the POS, only released once the seller checks
    // "Recorded in POS" (see markPosRecorded below).
    const seller = await Seller.findById(req.sellerId).select('posConnection.enabled').lean();
    if (!seller?.posConnection?.enabled) {
      for (const item of order.items) {
        if (item.reservationStatus === 'active') {
          await consume(item.listing, item.qty);
          item.reservationStatus = 'consumed';
        }
      }
    }
  }
  if (transition.to === 'delivered') {
    order.deliveredAt = new Date();
    await notify({ userId: order.customer, type: 'order.delivered', title: `Order ${order.orderNumber} was delivered`, link: '/orders' });
  }
  if (transition.to === 'cancelled') {
    order.cancelReason = reason || '';
    order.cancelledAt = new Date();
    order.autoCancelAt = null;
    // Follow-up — forward guard for Milestone 7's online payments: every
    // order today is COD (nothing was ever collected), so this is always
    // false in practice, but the check has to live at every place that
    // can cancel an order, not just appear once Milestone 7 needs it.
    if (order.paymentMethod !== 'cod') order.refundNeeded = true;
    for (const item of order.items) {
      if (item.reservationStatus === 'active') {
        await release(item.listing, item.qty);
        item.reservationStatus = 'released';
      }
    }
    await notify({ userId: order.customer, type: 'order.cancelled', title: `Order ${order.orderNumber} was cancelled`, body: reason || '', link: '/orders' });
  }
  if (transition.to === 'confirmed') {
    await notify({ userId: order.customer, type: 'order.confirmed', title: `Order ${order.orderNumber} was confirmed`, link: '/orders' });
  }
  if (transition.to === 'shipped') {
    await notify({ userId: order.customer, type: 'order.shipped', title: `Order ${order.orderNumber} has shipped`, body: trackingNumber ? `Tracking: ${trackingNumber}` : '', link: '/orders' });
  }
  await order.save();

  // Milestone 7 Part A.2 — posts the sale+commission ledger entries
  // exactly once, atomically claimed inside the service itself (see
  // services/ledger.js) — safe to call unconditionally here even on a
  // route that could theoretically be hit twice for the same order.
  if (transition.to === 'delivered') await postDeliveryLedgerEntries(order._id);

  res.json({ order: order.toObject() });
};

// POST /api/seller/orders/:id/transition { action: 'return' } — split out
// from the generic handler above because it needs a real guarantee, not
// just the usual "read, check, save" that every other transition uses:
// two "return" requests arriving at once must restock exactly once, never
// twice. The fix is the same shape as services/stockReservation.js's
// reserve() — a single findOneAndUpdate whose FILTER itself re-checks the
// precondition (status is still 'delivery_failed') at the moment of the
// write. MongoDB only ever lets one of two concurrent writes to the same
// document win; the loser's filter simply no longer matches once the
// winner has already flipped the status, so it comes back null here and
// this function returns 409 WITHOUT ever calling restock() — "only
// restock if a row was actually updated," not "restock, then check."
// Everything after the claim (the per-item stock calls, the audit log,
// the notification) only ever runs for whichever single request won it.
async function handleReturn(req, res, reason) {
  const order = await SellerOrder.findOne({ _id: req.params.id, seller: req.sellerId }).select('status').lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const claimed = await SellerOrder.findOneAndUpdate(
    { _id: req.params.id, seller: req.sellerId, status: 'delivery_failed' },
    { $set: { status: 'returned', returnedAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    return res.status(409).json({ message: `Cannot return: order is "${order.status}", not one of [delivery_failed].` });
  }

  // Follow-up — the reverse of the 'shipped' branch above: a non-POS
  // seller's permanent stock deduction (consume(), at ship time) is
  // undone now that the item is physically back; a POS-linked seller's
  // `stock` is never touched here (it's owned by the POS sync) — instead
  // this leaves the hold in place for the "not yet recorded in POS"
  // reminder to chase via returnPosRecorded (see markReturnPosRecorded).
  const seller = await Seller.findById(req.sellerId).select('posConnection.enabled').lean();
  const isPosConnected = !!seller?.posConnection?.enabled;
  for (const item of claimed.items) {
    if (isPosConnected) {
      if (item.reservationStatus === 'active') await release(item.listing, item.qty);
    } else if (item.reservationStatus === 'consumed') {
      await restock(item.listing, item.qty);
    } else if (item.reservationStatus === 'active') {
      await release(item.listing, item.qty);
    }
  }

  const finalOrder = await SellerOrder.findByIdAndUpdate(
    claimed._id,
    {
      $set: {
        'items.$[].reservationStatus': 'returned',
        refusedParcelCostCents: claimed.deliveryFeeCents, // Part B's fee, still a real cost even though the delivery failed
        // Follow-up — forward guard for Milestone 7: always false while
        // every order is COD (see the cancelled branch's identical check).
        ...(claimed.paymentMethod !== 'cod' ? { refundNeeded: true } : {}),
      },
      $push: { statusHistory: { from: 'delivery_failed', to: 'returned', by: req.user._id, reason: reason || '', at: new Date() } },
    },
    { new: true }
  ).lean();

  await logAction({
    actor: req.user, actorRole: req.sellerMember.role, action: 'order.return',
    targetType: 'SellerOrder', targetId: finalOrder._id,
    before: { status: 'delivery_failed' }, after: { status: 'returned', reason: reason || '' },
    summary: `Marked order ${finalOrder.orderNumber} returned${reason ? `: ${reason}` : ''}`,
  });

  // Milestone 7 Part A.3 — only when the platform has chosen to pass the
  // wasted courier trip on to the seller (owner-only setting, default
  // 'platform' = no seller entry at all). Safe to create unconditionally
  // here, no further claim needed — this whole function body only ever
  // runs once per order, for whichever single request won the atomic
  // claim above. Payable immediately: unlike a sale, there's no COD to
  // reconcile and no return-window reason to hold it (the parcel never
  // reached the customer).
  const settings = await getPlatformSettings();
  if (settings.refusedParcelChargedTo === 'seller' && finalOrder.refusedParcelCostCents > 0) {
    await LedgerEntry.create({
      seller: finalOrder.seller,
      type: 'refused_parcel_charge',
      amountCents: -finalOrder.refusedParcelCostCents,
      sellerOrder: finalOrder._id,
      status: 'payable',
      availableAt: new Date(),
      reason: 'Refused/returned parcel courier cost',
    });
  }

  await notify({
    userId: finalOrder.customer, type: 'order.returned',
    title: `Order ${finalOrder.orderNumber} was returned to the seller`,
    body: 'The delivery could not be completed, so this order has been returned.',
    link: '/orders',
  });

  res.json({ order: finalOrder });
}

// POST /api/seller/orders/:id/pos-recorded — Seller 1 only (Part D).
const markPosRecorded = async (req, res) => {
  const seller = await Seller.findById(req.sellerId).select('posConnection.enabled').lean();
  if (!seller?.posConnection?.enabled) return res.status(404).json({ message: 'Not found' });

  const order = await SellerOrder.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.posRecorded) return res.status(409).json({ message: 'Already recorded in the POS' });

  for (const item of order.items) {
    if (item.reservationStatus === 'active') {
      await release(item.listing, item.qty);
      item.reservationStatus = 'released';
    }
  }
  order.posRecorded = true;
  order.posRecordedAt = new Date();
  await order.save();

  res.json({ order: order.toObject() });
};

// POST /api/seller/orders/:id/return-pos-recorded — follow-up #5, Seller 1
// only. A separate checkbox/flag from markPosRecorded above (that one is
// the SALE; this one is the RETURN) — stock itself was already fully
// settled in handleReturn's POS branch above (the hold was released the
// moment the order was marked returned), so this is pure bookkeeping: it
// only exists to stop the "not yet recorded in POS" reminder from
// chasing the seller forever.
const markReturnPosRecorded = async (req, res) => {
  const seller = await Seller.findById(req.sellerId).select('posConnection.enabled').lean();
  if (!seller?.posConnection?.enabled) return res.status(404).json({ message: 'Not found' });

  const order = await SellerOrder.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'returned') return res.status(409).json({ message: `Cannot record: order is "${order.status}", not "returned".` });
  if (order.returnPosRecorded) return res.status(409).json({ message: 'Already recorded in the POS' });

  order.returnPosRecorded = true;
  order.returnPosRecordedAt = new Date();
  await order.save();

  res.json({ order: order.toObject() });
};

module.exports = {
  listOrders, getOrderDetail, transitionOrder, markPosRecorded, markReturnPosRecorded,
  TRANSITIONS, maskForSellerView, notRecordedInPosFilter,
};
