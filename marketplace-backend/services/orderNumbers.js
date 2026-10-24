const Counter = require('../models/Counter');

// APX-YYMM-NNNNN for the order, APX-YYMM-NNNNN-1 / -2 / ... per seller
// order within it (Milestone 6 spec, literal format). One counter per
// calendar month ("order-2602") so the sequence — and the zero-padded
// width it resets to — never grows unboundedly across the platform's
// lifetime.
async function nextOrderNumber(session) {
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `order-${yymm}`;

  // Atomic — a single document's findOneAndUpdate is always atomic in
  // MongoDB even outside a transaction, which is exactly what makes two
  // concurrent checkouts in the same month get two different sequence
  // numbers. Still passed the session so it rolls back together with the
  // rest of the order-creation transaction if something later in the same
  // checkout fails — an aborted checkout must not burn a number a real
  // order never used... except it's an $inc, so on abort the counter
  // genuinely does revert (session-scoped writes are reverted on abort).
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session }
  );

  const orderNumber = `APX-${yymm}-${String(counter.seq).padStart(5, '0')}`;
  return { orderNumber, yymm, seq: counter.seq };
}

function sellerOrderNumber(orderNumber, sellerIndex) {
  return `${orderNumber}-${sellerIndex + 1}`;
}

module.exports = { nextOrderNumber, sellerOrderNumber };
