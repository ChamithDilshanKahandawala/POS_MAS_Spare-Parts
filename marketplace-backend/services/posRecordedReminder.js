// Follow-up (Milestone 6) — same setInterval pattern as
// services/posSyncScheduler.js and services/orderAutoCancel.js: one
// process, one fixed-period sweep. Covers BOTH halves of "not yet
// recorded in POS": a POS-connected seller's Shipped/Delivered order not
// yet checked "Recorded in POS" (the sale), and a Returned order not yet
// checked "Return recorded in POS" (follow-up #5) — 24h after the
// relevant event, at most once a day per order, until the seller records
// it. See controllers/sellerOrdersController.js's notRecordedInPosFilter,
// which this reuses so the sweep and the Seller Orders filter can never
// disagree about what "not recorded" means.
//
// All comparisons below are plain epoch-millisecond arithmetic
// (Date.now(), stored Date fields) — a JS/BSON Date is always a UTC
// instant internally regardless of how it's later displayed, so none of
// this needs (or has) any timezone handling of its own; the console only
// ever converts to Asia/Colombo at the point it renders a timestamp on
// screen (src/utils/formatDateTime.js), never here or in the database.
const SellerOrder = require('../models/SellerOrder');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const { notify } = require('./notifications');

const INTERVAL_MS = 60 * 60 * 1000; // hourly
const THRESHOLD_MS = 24 * 60 * 60 * 1000; // "24 hours" after the triggering event
const RENOTIFY_MS = 24 * 60 * 60 * 1000; // "once a day"

let timer = null;

async function ownerUserId(sellerId) {
  const owner = await SellerMember.findOne({ seller: sellerId, role: 'seller_owner', status: 'active' }).select('user').lean();
  return owner?.user || null;
}

async function runSweep() {
  try {
    const posSellers = await Seller.find({ 'posConnection.enabled': true }).select('_id').lean();
    const sellerIds = posSellers.map((s) => s._id);
    if (sellerIds.length === 0) return 0;

    const cutoff = new Date(Date.now() - THRESHOLD_MS);
    const candidates = await SellerOrder.find({
      seller: { $in: sellerIds },
      $or: [
        { status: { $in: ['shipped', 'delivered'] }, posRecorded: false, shippedAt: { $lte: cutoff } },
        { status: 'returned', returnPosRecorded: false, returnedAt: { $lte: cutoff } },
      ],
    }).select('_id seller orderNumber status').lean();

    let notified = 0;
    for (const order of candidates) {
      // Atomic claim — the real fix (not the removed in-process
      // "runningNow" boolean, which only ever protected one process
      // against itself and does nothing once there are two backend
      // instances): this findOneAndUpdate's own FILTER re-checks that
      // nobody else already claimed this order's reminder slot, at the
      // moment of the write. Two sweeps racing on the same order — same
      // process or two different instances, doesn't matter — can only
      // ever have one of them actually flip posNotRecordedWarnedAt; the
      // loser's filter stops matching the instant the winner's write
      // lands, so it gets null back and sends nothing.
      const renotifyThreshold = new Date(Date.now() - RENOTIFY_MS);
      const claimed = await SellerOrder.findOneAndUpdate(
        {
          _id: order._id,
          $or: [{ posNotRecordedWarnedAt: null }, { posNotRecordedWarnedAt: { $lte: renotifyThreshold } }],
        },
        { $set: { posNotRecordedWarnedAt: new Date() } },
        { new: true }
      );
      if (!claimed) continue;

      const ownerId = await ownerUserId(order.seller);
      if (ownerId) {
        const forReturn = claimed.status === 'returned';
        await notify({
          userId: ownerId,
          type: 'pos.order_not_recorded',
          title: forReturn
            ? `Order ${order.orderNumber} isn't recorded as returned in your POS yet`
            : `Order ${order.orderNumber} isn't recorded in your POS yet`,
          body: forReturn
            ? 'Record this return in your POS so your stock stays accurate.'
            : 'Record this sale in your POS so your stock stays accurate — it\'s still being held here until you do.',
          link: '/seller/orders',
        });
      }
      notified += 1;
    }
    return notified;
  } catch (err) {
    console.error('[posRecordedReminder] sweep failed:', err.message);
    return 0;
  }
}

function startPosRecordedReminderJob() {
  if (timer) return;
  timer = setInterval(runSweep, INTERVAL_MS);
  timer.unref?.();
}

function stopPosRecordedReminderJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startPosRecordedReminderJob, stopPosRecordedReminderJob, runSweep };
