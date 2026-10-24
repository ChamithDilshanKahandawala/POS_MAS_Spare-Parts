const Listing = require('../models/Listing');

// Milestone 6 Part D. `available = stock - reservedQty` everywhere —
// reserve() is the one place that enforces it can never go negative, via
// a single atomic findOneAndUpdate whose FILTER itself re-checks
// available stock ($expr) at the moment of the write, not a separate
// read-then-write (which would race: two concurrent checkouts could both
// read "1 available" and both then decide to proceed). A single
// document's findOneAndUpdate is atomic in MongoDB regardless of whether
// it runs inside a transaction, which is what actually prevents the
// "last unit" race — the transaction/session passed in is for rolling
// back this reservation together with the rest of the order if a LATER
// item in the same checkout fails, not for the race safety itself.
//
// Returns the updated listing on success, or null if there wasn't enough
// available stock (or the listing no longer matches `status`) — the
// caller (services/orderCreation.js) treats null as "reject this item"
// and aborts the whole transaction.
async function reserve(listingId, qty, { session, requireStatus = 'published' } = {}) {
  return Listing.findOneAndUpdate(
    {
      _id: listingId,
      status: requireStatus,
      $expr: { $gte: [{ $subtract: ['$stock', '$reservedQty'] }, qty] },
    },
    { $inc: { reservedQty: qty } },
    { new: true, session }
  );
}

// Frees a hold without ever touching `stock` — used when a seller order
// (or one of its lines) is cancelled, and for a POS-linked seller's
// "Recorded in POS" checkbox (Part D: the real stock truth there is the
// POS's own number, picked up by the next sync; this reservation was only
// ever holding a spot against OTHER marketplace buyers in the meantime).
async function release(listingId, qty, { session } = {}) {
  return Listing.findOneAndUpdate(
    { _id: listingId },
    { $inc: { reservedQty: -qty } },
    { new: true, session }
  );
}

// Turns a hold into a permanent deduction — a non-POS seller's "mark
// shipped" (Part D). Never used for a POS-linked seller's items; those
// only ever go through release() via the "Recorded in POS" checkbox,
// because their `stock` field is owned by the POS sync, not by this app.
async function consume(listingId, qty, { session } = {}) {
  return Listing.findOneAndUpdate(
    { _id: listingId },
    { $inc: { stock: -qty, reservedQty: -qty } },
    { new: true, session }
  );
}

// The reverse of consume() — a non-POS seller's "mark returned" after a
// failed/refused delivery (follow-up). Only ever applied to a line whose
// reservationStatus is 'consumed' (the permanent deduction consume() made
// at ship time); never used for a POS-linked seller's items — their
// `stock` field is owned by the POS sync, never written here, same
// reasoning as consume()/release() above.
async function restock(listingId, qty, { session } = {}) {
  return Listing.findOneAndUpdate(
    { _id: listingId },
    { $inc: { stock: qty } },
    { new: true, session }
  );
}

module.exports = { reserve, release, consume, restock };
