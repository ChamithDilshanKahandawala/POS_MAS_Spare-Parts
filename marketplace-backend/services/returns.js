// Milestone 8 — returns and disputes. The state machine, the one-open-request-
// per-line claim, and the ledger effects of a refund all live here so the
// controllers stay thin and the rules are testable without HTTP.
const crypto = require('crypto');
const mongoose = require('mongoose');
const SellerOrder = require('../models/SellerOrder');
const ReturnRequest = require('../models/ReturnRequest');
const LedgerEntry = require('../models/LedgerEntry');
const Listing = require('../models/Listing');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const { getEffectiveCategory } = require('./categoryRules');
const { getPlatformSettings } = require('./platformSettings');
const { notify } = require('./notifications');
const { restock } = require('./stockReservation');
const { roundHalfUp } = require('./ledger');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TX_ATTEMPTS = 5;

const BLOCKED_MESSAGES = {
  not_delivered: 'Returns are only possible once the order has been delivered.',
  open_request: 'This item already has a return request in progress.',
  already_returned: 'This item has already been returned.',
  not_returnable: 'This item is not eligible for returns.',
  window_closed: 'The return window for this item has closed.',
};

class ReturnError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function newRequestNumber() {
  return `RTN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function ownerUserId(sellerId) {
  const owner = await SellerMember.findOne({ seller: sellerId, role: 'seller_owner', status: 'active' }).select('user').lean();
  return owner?.user || null;
}

async function notifySellerOwner(sellerId, payload) {
  const ownerId = await ownerUserId(sellerId);
  if (ownerId) await notify({ userId: ownerId, ...payload });
}

// The category's return policy for one listing. A listing deleted since the
// order was placed falls back to the platform default window — deliveredAt
// is still the only real clock.
async function returnPolicyFor(listingId, settings) {
  const fallback = { returnable: true, windowDays: settings.defaultReturnWindowDays };
  const listing = await Listing.findById(listingId).select('categoryId').lean();
  if (!listing) return fallback;
  const result = await getEffectiveCategory(listing.categoryId);
  if (!result) return fallback;
  const { returnable, windowDays } = result.effective.returnPolicy;
  return {
    returnable: returnable !== false,
    windowDays: windowDays ?? settings.defaultReturnWindowDays,
  };
}

// Per line: what the customer can still do with it right now. Shared by the
// order detail (so the UI only offers what the server would accept) and by
// createReturnRequest (so the server enforces exactly the same rules).
async function describeReturnability(sellerOrder, settings = null) {
  const cfg = settings || (await getPlatformSettings());
  const delivered = sellerOrder.status === 'delivered' && !!sellerOrder.deliveredAt;
  const lines = [];
  for (const item of sellerOrder.items) {
    const remainingQty = Math.max(0, item.qty - (item.refundedQty || 0));
    let windowEndsAt = null;
    let blockedReason = null;
    if (!delivered) {
      blockedReason = 'not_delivered';
    } else {
      const policy = await returnPolicyFor(item.listing, cfg);
      windowEndsAt = new Date(new Date(sellerOrder.deliveredAt).getTime() + policy.windowDays * DAY_MS);
      if (item.openReturnRequest) blockedReason = 'open_request';
      else if (remainingQty === 0) blockedReason = 'already_returned';
      else if (!policy.returnable) blockedReason = 'not_returnable';
      else if (Date.now() > windowEndsAt.getTime()) blockedReason = 'window_closed';
    }
    lines.push({
      itemId: String(item._id),
      remainingQty,
      windowEndsAt,
      canRequest: !blockedReason,
      blockedReason,
    });
  }
  return lines;
}

// Claims lines one at a time with a conditional update, so two requests for
// the same line can't both win. Any line that fails releases the ones already
// claimed, leaving the order exactly as it was.
async function releaseLineClaims(sellerOrderId, requestId, sellerOrderItemIds) {
  for (const itemId of sellerOrderItemIds) {
    await SellerOrder.updateOne(
      { _id: sellerOrderId, items: { $elemMatch: { _id: itemId, openReturnRequest: requestId } } },
      { $set: { 'items.$.openReturnRequest': null } }
    );
  }
}

async function createReturnRequest({ customerId, sellerOrderId, reason, customerNote, lines, photoPaths }) {
  const sellerOrder = await SellerOrder.findOne({ _id: sellerOrderId, customer: customerId }).lean();
  if (!sellerOrder) throw new ReturnError(404, 'Order not found');

  const settings = await getPlatformSettings();
  const described = await describeReturnability(sellerOrder, settings);
  const infoByItem = new Map(described.map((d) => [d.itemId, d]));

  if (new Set(lines.map((l) => l.itemId)).size !== lines.length) {
    throw new ReturnError(400, 'Each item can only be listed once per return request');
  }

  const snapshotLines = [];
  for (const { itemId, qty } of lines) {
    const item = sellerOrder.items.find((i) => String(i._id) === itemId);
    const info = infoByItem.get(itemId);
    if (!item || !info) throw new ReturnError(400, 'One of the selected items is not part of this order');
    if (qty > info.remainingQty) {
      throw new ReturnError(400, `You can return at most ${info.remainingQty} of ${item.title?.en || 'this item'}`);
    }
    if (!info.canRequest) throw new ReturnError(409, BLOCKED_MESSAGES[info.blockedReason]);
    snapshotLines.push({
      sellerOrderItem: item._id,
      listing: item.listing,
      title: item.title,
      sku: item.sku,
      unitPriceCents: item.unitPriceCents,
      qty,
    });
  }

  const requestId = new mongoose.Types.ObjectId();
  const claimedItemIds = [];
  for (const line of snapshotLines) {
    const result = await SellerOrder.updateOne(
      {
        _id: sellerOrder._id,
        status: 'delivered',
        items: { $elemMatch: { _id: line.sellerOrderItem, openReturnRequest: null } },
      },
      { $set: { 'items.$.openReturnRequest': requestId } }
    );
    if (result.modifiedCount !== 1) {
      await releaseLineClaims(sellerOrder._id, requestId, claimedItemIds);
      throw new ReturnError(409, BLOCKED_MESSAGES.open_request);
    }
    claimedItemIds.push(line.sellerOrderItem);
  }

  const now = new Date();
  const refundItemsCents = snapshotLines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
  let request;
  try {
    request = await ReturnRequest.create({
      _id: requestId,
      requestNumber: newRequestNumber(),
      sellerOrder: sellerOrder._id,
      order: sellerOrder.order,
      seller: sellerOrder.seller,
      customer: customerId,
      orderNumber: sellerOrder.orderNumber,
      reason,
      customerNote,
      photos: photoPaths.map((path) => ({ path })),
      lines: snapshotLines,
      refundItemsCents,
      responseDeadlineAt: new Date(now.getTime() + settings.returnResponseDays * DAY_MS),
      timeline: [{ from: null, to: 'requested', by: customerId, byRole: 'customer', at: now }],
    });
  } catch (err) {
    await releaseLineClaims(sellerOrder._id, requestId, claimedItemIds);
    throw err;
  }

  await notifySellerOwner(sellerOrder.seller, {
    type: 'return.requested',
    title: `Return requested for ${sellerOrder.orderNumber}`,
    body: 'The customer has asked to return one or more items. Respond within the deadline.',
    link: '/seller/returns',
  });

  return request;
}

async function conflictOrNotFound(filter, message) {
  const exists = await ReturnRequest.exists(filter);
  return exists ? new ReturnError(409, message) : new ReturnError(404, 'Return request not found');
}

async function sellerRespond({ sellerId, returnId, actor, actorRole, accept, note }) {
  const next = accept ? 'seller_accepted' : 'seller_rejected';
  const now = new Date();
  const claimed = await ReturnRequest.findOneAndUpdate(
    { _id: returnId, seller: sellerId, status: 'requested' },
    {
      $set: { status: next, sellerNote: note, sellerRespondedAt: now },
      $push: { timeline: { from: 'requested', to: next, by: actor._id, byRole: actorRole, note, at: now } },
    },
    { new: true }
  );
  if (!claimed) {
    throw await conflictOrNotFound({ _id: returnId, seller: sellerId }, 'This return is no longer waiting for a seller response.');
  }

  await notify({
    userId: claimed.customer,
    type: accept ? 'return.accepted' : 'return.rejected',
    title: accept
      ? `Return accepted for ${claimed.orderNumber}`
      : `Return rejected for ${claimed.orderNumber}`,
    body: accept
      ? 'Please send the item back. Your refund follows once it has been received.'
      : 'The seller rejected this return. It has been passed to our team for review.',
    link: '/orders',
  });
  return claimed;
}

async function markReceived({ sellerId, returnId, actor, actorRole }) {
  const now = new Date();
  const claimed = await ReturnRequest.findOneAndUpdate(
    { _id: returnId, seller: sellerId, status: { $in: ['seller_accepted', 'admin_decided'] } },
    {
      $set: { status: 'item_returned', receivedAt: now },
      $push: { timeline: { from: 'awaiting_return', to: 'item_returned', by: actor._id, byRole: actorRole, at: now } },
    },
    { new: true }
  );
  if (!claimed) {
    throw await conflictOrNotFound(
      { _id: returnId, seller: sellerId },
      'Only accepted or decided returns can be marked as received.'
    );
  }

  // A non-POS seller's stock was deducted permanently when the parcel shipped
  // (reservationStatus 'consumed'); the item is physically back now, so put it
  // back. A POS-linked seller's stock lives in the POS and is not touched here.
  const seller = await Seller.findById(sellerId).select('posConnection.enabled').lean();
  if (!seller?.posConnection?.enabled) {
    const sellerOrder = await SellerOrder.findById(claimed.sellerOrder).select('items').lean();
    for (const line of claimed.lines) {
      const item = sellerOrder.items.find((i) => String(i._id) === String(line.sellerOrderItem));
      if (item?.reservationStatus === 'consumed') await restock(line.listing, line.qty);
    }
  }
  return claimed;
}

async function adminDecide({ returnId, actor, actorRole, uphold, note }) {
  const now = new Date();
  const next = uphold ? 'admin_decided' : 'closed';
  const claimed = await ReturnRequest.findOneAndUpdate(
    { _id: returnId, status: { $in: ['seller_rejected', 'escalated'] } },
    {
      $set: {
        status: next,
        decision: uphold ? 'refund' : 'dismissed',
        adminNote: note,
        adminDecidedAt: now,
      },
      $push: { timeline: { from: 'escalated', to: next, by: actor._id, byRole: actorRole, note, at: now } },
    },
    { new: true }
  );
  if (!claimed) {
    throw await conflictOrNotFound({ _id: returnId }, 'Only rejected or escalated returns can be decided.');
  }

  if (!uphold) await releaseLineClaims(claimed.sellerOrder, claimed._id, claimed.lines.map((l) => l.sellerOrderItem));

  const payload = {
    type: 'return.decided',
    title: uphold ? `Return approved for ${claimed.orderNumber}` : `Return declined for ${claimed.orderNumber}`,
    body: note,
  };
  await notify({ userId: claimed.customer, ...payload, link: '/orders' });
  await notifySellerOwner(claimed.seller, { ...payload, link: '/seller/returns' });
  return claimed;
}

// Posts the three refund-side ledger rows for one refunded return. Commission
// is reversed proportionally: the total reversal across all refunds on an
// order is round(cumulativeRefund × commission / itemsTotal), and this call
// adds only the difference from what was already reversed. Rounding therefore
// never drifts, and a full refund reverses exactly the commission charged.
async function postReturnLedger(returnRequest, { payer, shippingCents, actor }, session) {
  const sellerOrder = await SellerOrder.findById(returnRequest.sellerOrder).select('itemsTotalCents').session(session).lean();
  const commission = await LedgerEntry.findOne({ sellerOrder: returnRequest.sellerOrder, type: 'commission' }).session(session).lean();
  const commissionCents = commission ? -commission.amountCents : 0;

  const refundedSoFar = await ReturnRequest.find({ sellerOrder: returnRequest.sellerOrder, status: 'refunded' })
    .select('refundItemsCents')
    .session(session)
    .lean();
  const cumulativeRefundCents = refundedSoFar.reduce((sum, r) => sum + r.refundItemsCents, 0);

  const [reversedRow] = await LedgerEntry.aggregate([
    { $match: { sellerOrder: returnRequest.sellerOrder, type: 'return_commission_reversal' } },
    { $group: { _id: null, total: { $sum: '$amountCents' } } },
  ]).session(session);
  const alreadyReversed = reversedRow?.total || 0;

  const targetReversal = sellerOrder.itemsTotalCents > 0
    ? roundHalfUp((cumulativeRefundCents * commissionCents) / sellerOrder.itemsTotalCents)
    : 0;
  const reversalCents = targetReversal - alreadyReversed;

  const base = {
    seller: returnRequest.seller,
    sellerOrder: returnRequest.sellerOrder,
    status: 'payable',
    availableAt: null,
    createdBy: actor._id,
  };
  const entries = [];
  if (returnRequest.refundItemsCents > 0) {
    entries.push({ ...base, type: 'return_refund', amountCents: -returnRequest.refundItemsCents, reason: `Return ${returnRequest.requestNumber} refunded` });
  }
  if (reversalCents !== 0) {
    entries.push({ ...base, type: 'return_commission_reversal', amountCents: reversalCents, reason: `Commission reversed for return ${returnRequest.requestNumber}` });
  }
  if (payer === 'seller' && shippingCents > 0) {
    entries.push({ ...base, type: 'return_shipping', amountCents: -shippingCents, reason: `Return shipping for ${returnRequest.requestNumber}` });
  }
  if (entries.length) await LedgerEntry.create(entries, { session });
}

const TRANSIENT = (err) => err.hasErrorLabel?.('TransientTransactionError') || err.errorLabelSet?.has?.('TransientTransactionError') || err.code === 112;

async function markRefunded({ returnId, actor, actorRole, payer, shippingCents, method, reference }) {
  const current = await ReturnRequest.findById(returnId).lean();
  if (!current) throw new ReturnError(404, 'Return request not found');
  if (current.status !== 'item_returned') throw new ReturnError(409, 'Only returns the seller has received can be marked refunded.');

  const customerRefundCents = current.refundItemsCents - (payer === 'customer' ? shippingCents : 0);
  if (customerRefundCents < 0) {
    throw new ReturnError(400, 'Return shipping charged to the customer cannot exceed the refund amount.');
  }

  for (let attempt = 1; attempt <= MAX_TX_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const now = new Date();
      const claimed = await ReturnRequest.findOneAndUpdate(
        { _id: returnId, status: 'item_returned' },
        {
          $set: {
            status: 'refunded',
            'resolution.returnShippingPayer': payer,
            'resolution.returnShippingCents': shippingCents,
            'resolution.customerRefundCents': customerRefundCents,
            'resolution.refundMethod': method,
            'resolution.refundReference': reference,
            'resolution.refundedAt': now,
          },
          $push: { timeline: { from: 'item_returned', to: 'refunded', by: actor._id, byRole: actorRole, note: `${method} · ${reference}`, at: now } },
        },
        { new: true, session }
      );
      if (!claimed) throw new ReturnError(409, 'This return was already refunded.');

      await postReturnLedger(claimed, { payer, shippingCents, actor }, session);

      for (const line of claimed.lines) {
        await SellerOrder.updateOne(
          { _id: claimed.sellerOrder, items: { $elemMatch: { _id: line.sellerOrderItem } } },
          { $inc: { 'items.$.refundedQty': line.qty }, $set: { 'items.$.openReturnRequest': null } },
          { session }
        );
      }

      await session.commitTransaction();
      await notify({
        userId: claimed.customer,
        type: 'return.refunded',
        title: `Refund sent for ${claimed.orderNumber}`,
        body: `Rs. ${(customerRefundCents / 100).toFixed(2)} via ${method === 'cash' ? 'cash' : 'bank transfer'}.`,
        link: '/orders',
      });
      await notifySellerOwner(claimed.seller, {
        type: 'return.refunded',
        title: `Refund paid for ${claimed.orderNumber}`,
        body: 'The refund has been recorded against your balance.',
        link: '/seller/finance',
      });
      return claimed;
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      if (TRANSIENT(err) && attempt < MAX_TX_ATTEMPTS) continue;
      throw err;
    } finally {
      session.endSession();
    }
  }
  return null;
}

// Pending seller responses past their deadline go to platform staff. The
// claim (status:'requested' filter) means a seller who responds at the same
// moment wins, and the escalation is skipped.
async function escalateOverdueRequests(now = new Date()) {
  const overdue = await ReturnRequest.find({ status: 'requested', responseDeadlineAt: { $lte: now } })
    .select('_id customer seller orderNumber')
    .lean();
  let escalated = 0;
  for (const rr of overdue) {
    const claimed = await ReturnRequest.findOneAndUpdate(
      { _id: rr._id, status: 'requested' },
      {
        $set: { status: 'escalated' },
        $push: { timeline: { from: 'requested', to: 'escalated', by: null, byRole: 'system', note: 'No seller response before the deadline', at: now } },
      },
      { new: true }
    );
    if (!claimed) continue;
    escalated += 1;
    await notify({
      userId: claimed.customer,
      type: 'return.escalated',
      title: `Return for ${claimed.orderNumber} is with our team`,
      body: 'The seller did not respond in time, so our team will decide.',
      link: '/orders',
    });
    await notifySellerOwner(claimed.seller, {
      type: 'return.escalated',
      title: `Return for ${claimed.orderNumber} escalated`,
      body: 'You did not respond before the deadline, so the platform will decide.',
      link: '/seller/returns',
    });
  }
  return escalated;
}

module.exports = {
  ReturnError,
  BLOCKED_MESSAGES,
  describeReturnability,
  createReturnRequest,
  sellerRespond,
  markReceived,
  adminDecide,
  markRefunded,
  escalateOverdueRequests,
};
