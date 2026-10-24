const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const Category = require('../models/Category');
const Seller = require('../models/Seller');
const Order = require('../models/Order');
const SellerOrder = require('../models/SellerOrder');
const { getPlatformSettings } = require('./platformSettings');
const { getEffectiveCommissionBps } = require('./categoryRules');
const { computeParcelWeight, computeFeeCents } = require('./deliveryFee');
const { reserve } = require('./stockReservation');
const { nextOrderNumber, sellerOrderNumber } = require('./orderNumbers');
const { notify } = require('./notifications');
const SellerMember = require('../models/SellerMember');

const POS_STALE_AFTER_MS = 30 * 60 * 1000; // Part C: 30 minutes

// Thrown for any "the cart as the customer knows it no longer matches
// reality" case — caught by the controller and turned into a 409 with
// `issues` for the storefront to show against each affected cart line.
// Never thrown for a genuine bug (programming errors propagate as
// ordinary exceptions and become a 500, same as everywhere else).
class CheckoutRejected extends Error {
  constructor(issues) {
    super('Checkout rejected');
    this.issues = issues;
  }
}

// One item's full, fresh read — the single source of truth every price/
// stock/availability check and the final order snapshot both come from.
// Never trusts anything the client sent about this listing except WHICH
// one (listingId) and HOW MANY (qty).
async function loadItemContext(listingId, qty) {
  const listing = await Listing.findById(listingId).populate('seller').lean();
  if (!listing) return { issue: { listingId, reason: 'not_found' } };

  const category = await Category.findById(listing.categoryId).lean();
  const seller = listing.seller;

  if (listing.status !== 'published' || !seller || seller.status !== 'active' || !category || !category.active) {
    return { issue: { listingId, reason: 'no_longer_available' } };
  }

  const available = Math.max(0, listing.stock - listing.reservedQty);
  if (available < qty) {
    return { issue: { listingId, reason: 'insufficient_stock', availableQty: available } };
  }

  if (seller.posConnection?.enabled) {
    const lastSync = seller.posConnection.lastSuccessfulSyncAt;
    if (!lastSync || Date.now() - new Date(lastSync).getTime() > POS_STALE_AFTER_MS) {
      return { issue: { listingId, reason: 'temporarily_unavailable' } };
    }
  }

  return { listing, category, seller };
}

// Builds the seller-grouped breakdown (items, weight, delivery fee, COD
// amount, totals) for a validated cart — shared by the read-only preview
// and the real order placement, so the number a customer sees in preview
// is computed by the exact same code that later charges them, never a
// slightly different approximation.
async function buildSellerGroups(contexts, settings, district) {
  const bySeller = new Map();
  for (const ctx of contexts) {
    const sellerId = String(ctx.seller._id);
    if (!bySeller.has(sellerId)) bySeller.set(sellerId, { seller: ctx.seller, contexts: [] });
    bySeller.get(sellerId).contexts.push(ctx);
  }

  return [...bySeller.values()].map(({ seller, contexts: items }) => {
    const lines = items.map((ctx) => ({
      listingId: ctx.listing._id,
      title: ctx.listing.title,
      sku: ctx.listing.sku,
      unitPriceCents: ctx.listing.priceCents,
      qty: ctx.qty,
      lineTotalCents: ctx.listing.priceCents * ctx.qty,
      weightGrams: ctx.listing.weightGrams,
      commissionRateBps: getEffectiveCommissionBps(ctx.category, seller),
    }));

    const { weightKg, flaggedListingIds } = computeParcelWeight(
      items.map((ctx) => ({ listingId: ctx.listing._id, qty: ctx.qty, weightGrams: ctx.listing.weightGrams }))
    );
    const flagged = new Set(flaggedListingIds.map(String));
    for (const line of lines) line.weightEstimated = flagged.has(String(line.listingId));

    const itemsTotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    const deliveryFeeCents = computeFeeCents(weightKg, settings.deliveryRates[district]);

    return { seller, lines, itemsTotalCents, deliveryFeeCents, codAmountCents: itemsTotalCents + deliveryFeeCents, weightKg };
  });
}

// Re-reads every item fresh and returns either the validated per-item
// contexts or throws CheckoutRejected with one issue per problem line —
// used by both the read-only preview and the real order placement so
// they can never disagree about what's actually orderable right now.
async function validateItems(items) {
  const results = await Promise.all(items.map((i) => loadItemContext(i.listingId, i.qty)));
  const issues = [];
  const contexts = [];
  results.forEach((r, idx) => {
    if (r.issue) { issues.push(r.issue); return; }
    const requested = items[idx];
    if (requested.expectedPriceCents != null && requested.expectedPriceCents !== r.listing.priceCents) {
      issues.push({ listingId: requested.listingId, reason: 'price_changed', newPriceCents: r.listing.priceCents });
      return;
    }
    contexts.push({ ...r, qty: requested.qty });
  });
  if (issues.length) throw new CheckoutRejected(issues);
  return contexts;
}

// GET-shaped — no reservation, no transaction, safe to call on every
// cart/address change. The same validateItems()/buildSellerGroups() the
// real placement uses, so what the customer sees here is never a
// different calculation than what they're actually charged — only
// potentially stale by however long they wait before clicking "place
// order" (which re-validates from scratch anyway).
async function previewCheckout({ district, items }) {
  const settings = (await getPlatformSettings()).toObject();
  const contexts = await validateItems(items); // throws CheckoutRejected on any problem
  const sellerGroups = await buildSellerGroups(contexts, settings, district);

  const itemsTotalCents = sellerGroups.reduce((s, g) => s + g.itemsTotalCents, 0);
  const deliveryTotalCents = sellerGroups.reduce((s, g) => s + g.deliveryFeeCents, 0);
  return { sellerGroups, itemsTotalCents, deliveryTotalCents, grandTotalCents: itemsTotalCents + deliveryTotalCents };
}

// The real thing — Part C. Everything below runs inside ONE transaction:
// re-validate, atomically reserve stock per line, create the Order + one
// SellerOrder per seller. Any single failure aborts the whole checkout,
// including every reservation already made earlier in the same loop —
// never a half-placed order.
async function placeOrder({ customer, address, customerNote, items, idempotencyKey }) {
  // Idempotency pre-check (Part C) — a plain read before touching the
  // transaction at all. Not perfectly race-proof on its own (two
  // simultaneous requests with the same key could both pass this check),
  // but the unique index on {customer, idempotencyKey} is the real
  // backstop: the second insert attempt below throws a duplicate-key
  // error, caught further down, and this same lookup runs again to
  // return the order the first request actually created.
  const existing = await Order.findOne({ customer: customer._id, idempotencyKey }).lean();
  if (existing) return { order: existing, alreadyPlaced: true };

  const settings = (await getPlatformSettings()).toObject();
  if (!settings.onlineOrderingEnabled) {
    throw Object.assign(new Error('Online ordering is not enabled yet'), { statusCode: 403 });
  }

  // Two checkouts racing for the same unit of stock don't block each
  // other under MongoDB's transaction snapshot isolation — the loser's
  // write to the contested Listing document fails with a storage-level
  // WriteConflict (a transient, expected outcome of real concurrency, not
  // a bug), and the documented fix is to retry the WHOLE transaction from
  // scratch. On retry, validateItems()/reserve() re-read fresh state —
  // the loser then correctly sees the stock the winner already reserved
  // and gets a clean CheckoutRejected('insufficient_stock'), not a crash.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await attemptPlaceOrder({ customer, address, customerNote, items, idempotencyKey, settings });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate-key race on {customer, idempotencyKey} — another
        // request for this exact same checkout already won; return what
        // it created instead of surfacing an error for a retry that
        // actually succeeded.
        const raced = await Order.findOne({ customer: customer._id, idempotencyKey }).lean();
        if (raced) return { order: raced, alreadyPlaced: true };
      }
      const isTransient = err.hasErrorLabel?.('TransientTransactionError') || err.errorLabelSet?.has?.('TransientTransactionError') || err.code === 112;
      if (isTransient && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }
  throw new Error('Could not place order after repeated transient conflicts — please try again');
}

async function attemptPlaceOrder({ customer, address, customerNote, items, idempotencyKey, settings }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const contexts = await validateItems(items); // throws CheckoutRejected — no reservations made yet
    const sellerGroups = await buildSellerGroups(contexts, settings, address.district);

    // Reserve every line atomically, in-transaction — if any single line
    // can't be reserved (a race since validateItems() read moments ago),
    // the whole transaction aborts and nothing from this checkout sticks.
    const reservationIssues = [];
    for (const group of sellerGroups) {
      for (const line of group.lines) {
        const updated = await reserve(line.listingId, line.qty, { session });
        if (!updated) reservationIssues.push({ listingId: line.listingId, reason: 'insufficient_stock' });
      }
    }
    if (reservationIssues.length) throw new CheckoutRejected(reservationIssues);

    const { orderNumber } = await nextOrderNumber(session);
    const autoCancelAt = new Date(Date.now() + settings.autoCancelAfterHours * 60 * 60 * 1000);
    const shippingAddress = {
      label: address.label || '', line1: address.line1, line2: address.line2 || '',
      city: address.city, district: address.district, landmark: address.landmark || '', phone: address.phone,
    };

    // Pre-generated so SellerOrder's required `order` ref can point at it
    // immediately — the Order document itself is created afterward with
    // this same _id explicitly set, rather than creating SellerOrders
    // with a temporarily-null order ref and backfilling it after.
    const orderId = new mongoose.Types.ObjectId();

    const sellerOrderDocs = [];
    for (let i = 0; i < sellerGroups.length; i += 1) {
      const group = sellerGroups[i];
      const [doc] = await SellerOrder.create([{
        orderNumber: sellerOrderNumber(orderNumber, i),
        order: orderId,
        seller: group.seller._id,
        customer: customer._id,
        shippingAddress,
        customerNote: customerNote || '',
        items: group.lines.map((l) => ({
          listing: l.listingId, title: l.title, sku: l.sku, unitPriceCents: l.unitPriceCents, qty: l.qty,
          lineTotalCents: l.lineTotalCents, weightGrams: l.weightGrams, weightEstimated: l.weightEstimated,
          commissionRateBps: l.commissionRateBps, reservationStatus: 'active',
        })),
        itemsTotalCents: group.itemsTotalCents,
        deliveryFeeCents: group.deliveryFeeCents,
        codAmountCents: group.codAmountCents,
        weightKg: group.weightKg,
        // Follow-up — every order today is Cash on Delivery (Part C never
        // offers another option); explicit here, not just the schema
        // default, so it's obvious this is a real decision this flow
        // makes, not an oversight — see SellerOrder.paymentMethod.
        paymentMethod: 'cod',
        status: 'new',
        statusHistory: [{ from: null, to: 'new', by: customer._id, at: new Date() }],
        autoCancelAt,
      }], { session });
      sellerOrderDocs.push(doc);
    }

    const itemsTotalCents = sellerGroups.reduce((s, g) => s + g.itemsTotalCents, 0);
    const deliveryTotalCents = sellerGroups.reduce((s, g) => s + g.deliveryFeeCents, 0);

    const [order] = await Order.create([{
      _id: orderId,
      orderNumber,
      customer: customer._id,
      idempotencyKey,
      shippingAddress,
      customerNote: customerNote || '',
      sellerOrders: sellerOrderDocs.map((d) => d._id),
      itemsTotalCents,
      deliveryTotalCents,
      grandTotalCents: itemsTotalCents + deliveryTotalCents,
    }], { session });

    await session.commitTransaction();

    // Notifications are deliberately outside the transaction — a failure
    // to notify must never roll back an otherwise-successful order.
    await Promise.all(sellerOrderDocs.map(async (so) => {
      const owner = await SellerMember.findOne({ seller: so.seller, role: 'seller_owner', status: 'active' }).select('user').lean();
      if (owner) {
        await notify({
          userId: owner.user,
          type: 'order.new',
          title: `New order ${so.orderNumber}`,
          body: `${so.items.length} item(s), COD Rs. ${(so.codAmountCents / 100).toFixed(2)}`,
          link: '/seller/orders',
        });
      }
    }));

    return { order, alreadyPlaced: false };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { previewCheckout, placeOrder, validateItems, buildSellerGroups, CheckoutRejected, POS_STALE_AFTER_MS };
