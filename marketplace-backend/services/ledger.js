const mongoose = require('mongoose');
const SellerOrder = require('../models/SellerOrder');
const LedgerEntry = require('../models/LedgerEntry');
const { getPlatformSettings } = require('./platformSettings');

// Round-half-up, applied exactly once to the WHOLE order's commission
// (never per line) — per the Milestone 7 Part A.2 spec. Math.round()
// already rounds half-up for any non-negative input (ties go to
// +Infinity), and a commission magnitude is always non-negative here
// (it's computed from positive line totals and a non-negative bps rate),
// so this is just Math.round with a name that says why.
function roundHalfUp(n) {
  return Math.round(n);
}

// Milestone 7 Part A.2 — called the moment a seller order's status
// becomes 'delivered', from both places that can make that transition
// (controllers/sellerOrdersController.js's transitionOrder and
// controllers/adminOrdersController.js's moveOrderOn). Creates exactly
// one 'sale' + one 'commission' LedgerEntry, both on_hold until
// deliveredAt + holdDays.
//
// "Exactly once" has two independent layers of defense:
//   1. An atomic claim (findOneAndUpdate filtered on ledgerPostedAt being
//      still null) — only the request that wins this claim ever reaches
//      the transaction below. Mirrors the same pattern
//      sellerOrdersController.js's handleReturn already established for
//      "only restock once."
//   2. LedgerEntry's own unique index on {sellerOrder, type} for
//      sale/commission — a DB-level backstop per the spec's explicit
//      ask, in case this function is ever called from a third place that
//      doesn't go through the claim (it never is today, but the index
//      doesn't rely on that staying true).
async function postDeliveryLedgerEntries(sellerOrderId) {
  const claimed = await SellerOrder.findOneAndUpdate(
    { _id: sellerOrderId, ledgerPostedAt: null },
    { $set: { ledgerPostedAt: new Date() } },
    { new: true }
  );
  if (!claimed) return; // already posted (or no such order) — nothing to do

  const settings = await getPlatformSettings();
  const holdMs = (settings.payoutHoldDays || 0) * 24 * 60 * 60 * 1000;
  const availableAt = new Date((claimed.deliveredAt || new Date()).getTime() + holdMs);

  // Commission is computed across every line (each can carry a different
  // commissionRateBps — a category override or a seller-specific
  // override both snapshot onto the line at order time), summed as exact
  // fractional cents, and rounded ONCE at the end — never per line, which
  // would let per-line rounding drift away from "exactly
  // round(itemsTotal × rate)" for a mixed-rate cart.
  const rawCommission = claimed.items.reduce(
    (sum, item) => sum + (item.lineTotalCents * item.commissionRateBps) / 10000,
    0
  );
  const commissionCents = roundHalfUp(rawCommission);

  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await LedgerEntry.create([
        {
          seller: claimed.seller,
          type: 'sale',
          amountCents: claimed.itemsTotalCents,
          sellerOrder: claimed._id,
          status: 'on_hold',
          availableAt,
        },
        {
          seller: claimed.seller,
          type: 'commission',
          amountCents: -commissionCents,
          sellerOrder: claimed._id,
          status: 'on_hold',
          availableAt,
        },
      ], { session });
      await session.commitTransaction();
      return;
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      if (err.code === 11000) return; // another caller already posted this order — fine
      const isTransient = err.hasErrorLabel?.('TransientTransactionError') || err.errorLabelSet?.has?.('TransientTransactionError') || err.code === 112;
      if (isTransient && attempt < MAX_ATTEMPTS) continue;
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = { postDeliveryLedgerEntries, roundHalfUp };
