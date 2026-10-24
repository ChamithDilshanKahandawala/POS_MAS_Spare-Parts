// Milestone 6 Part D/G — same setInterval pattern as
// services/posSyncScheduler.js (one process, one fixed-period job; a
// cron dependency would be more machinery than this needs). Runs two
// independent sweeps every tick: warn sellers whose unconfirmed order is
// ~12h from auto-cancelling, then actually auto-cancel whatever has
// passed its deadline.
const SellerOrder = require('../models/SellerOrder');
const SellerMember = require('../models/SellerMember');
const { release } = require('./stockReservation');
const { notify } = require('./notifications');

const INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes — fine-grained enough against an hours-long deadline
const WARNING_WINDOW_MS = 12 * 60 * 60 * 1000;

let timer = null;
let runningNow = false;

async function ownerUserId(sellerId) {
  const owner = await SellerMember.findOne({ seller: sellerId, role: 'seller_owner', status: 'active' }).select('user').lean();
  return owner?.user || null;
}

async function sendWarnings() {
  const cutoff = new Date(Date.now() + WARNING_WINDOW_MS);
  const dueSoon = await SellerOrder.find({
    status: 'new',
    autoCancelAt: { $lte: cutoff, $gt: new Date() },
    autoCancelWarnedAt: null,
  });

  for (const order of dueSoon) {
    const ownerId = await ownerUserId(order.seller);
    if (ownerId) {
      await notify({
        userId: ownerId,
        type: 'order.autocancel_warning',
        title: `Order ${order.orderNumber} auto-cancels soon`,
        body: 'Confirm it before the deadline or it will be automatically cancelled and the customer notified.',
        link: '/seller/orders',
      });
    }
    order.autoCancelWarnedAt = new Date();
    await order.save();
  }
  return dueSoon.length;
}

async function cancelOverdue() {
  const overdue = await SellerOrder.find({ status: 'new', autoCancelAt: { $lte: new Date() } });

  for (const order of overdue) {
    const from = order.status;
    order.status = 'cancelled';
    order.cancelReason = 'Automatically cancelled — not confirmed in time';
    order.cancelledAt = new Date();
    order.autoCancelAt = null;
    // Follow-up — forward guard for Milestone 7: every order today is
    // COD, so this never actually fires yet; see the identical check in
    // sellerOrdersController.js's cancelled branch.
    if (order.paymentMethod !== 'cod') order.refundNeeded = true;
    order.statusHistory.push({ from, to: 'cancelled', by: null, reason: order.cancelReason, at: new Date() });
    for (const item of order.items) {
      if (item.reservationStatus === 'active') {
        await release(item.listing, item.qty);
        item.reservationStatus = 'released';
      }
    }
    await order.save();

    const ownerId = await ownerUserId(order.seller);
    await Promise.all([
      notify({ userId: order.customer, type: 'order.cancelled', title: `Order ${order.orderNumber} was cancelled`, body: 'It was not confirmed in time.', link: '/orders' }),
      ...(ownerId ? [notify({ userId: ownerId, type: 'order.cancelled', title: `Order ${order.orderNumber} auto-cancelled`, body: 'It was not confirmed before the deadline.', link: '/seller/orders' })] : []),
    ]);
  }
  return overdue.length;
}

async function runSweep() {
  if (runningNow) return;
  runningNow = true;
  try {
    await sendWarnings();
    await cancelOverdue();
  } catch (err) {
    console.error('[orderAutoCancel] sweep failed:', err.message);
  } finally {
    runningNow = false;
  }
}

function startOrderAutoCancelJob() {
  if (timer) return;
  timer = setInterval(runSweep, INTERVAL_MS);
  timer.unref?.();
}

function stopOrderAutoCancelJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startOrderAutoCancelJob, stopOrderAutoCancelJob, runSweep, sendWarnings, cancelOverdue };
