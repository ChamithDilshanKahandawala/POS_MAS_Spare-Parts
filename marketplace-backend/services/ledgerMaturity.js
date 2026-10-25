const LedgerEntry = require('../models/LedgerEntry');
const SellerOrder = require('../models/SellerOrder');

// Milestone 7 Part B.3 — a daily sweep that moves 'on_hold' sale/
// commission entries to 'payable' once BOTH:
//   1. availableAt has passed (the return-window hold from Part A.2), AND
//   2. the order's COD has been reconciled, if it was ever a COD order
//      (services/remittance.js sets SellerOrder.codMatched on an exact
//      'matched' remittance row) — a non-COD order (Milestone 7's future
//      prepaid path) has nothing to reconcile here and only needs (1).
// An entry whose availableAt has passed but whose COD still isn't
// matched is simply left on_hold and re-checked on the next run — there
// is no separate "ready but blocked" state, the query just naturally
// stops returning it as ready once reconciled.
//
// Runs once a day (same setInterval-per-process shape as
// services/orderAutoCancel.js and services/posRecordedReminder.js — no
// cron dependency, see those files for why). No in-process mutex is
// needed the way posRecordedReminder.js once worried about across
// multiple instances: moving an entry on_hold -> payable is naturally
// idempotent (running the same update twice on an already-payable entry
// is a harmless no-op, unlike "send a notification" or "restock," which
// is why those needed an atomic claim and this doesn't).
const INTERVAL_MS = 24 * 60 * 60 * 1000;

let timer = null;

async function runSweep() {
  const now = new Date();
  const candidates = await LedgerEntry.find({
    type: { $in: ['sale', 'commission'] },
    status: 'on_hold',
    availableAt: { $lte: now },
  }).select('_id sellerOrder').lean();

  if (candidates.length === 0) {
    console.log('[ledgerMaturity] sweep: nothing due');
    return { moved: 0, stillWaitingOnCod: 0 };
  }

  const sellerOrderIds = [...new Set(candidates.map((c) => String(c.sellerOrder)))];
  const orders = await SellerOrder.find({ _id: { $in: sellerOrderIds } })
    .select('_id paymentMethod codMatched').lean();
  const codReadyBySellerOrder = new Map(
    orders.map((o) => [String(o._id), o.paymentMethod !== 'cod' || o.codMatched])
  );

  const readyIds = candidates
    .filter((c) => codReadyBySellerOrder.get(String(c.sellerOrder)))
    .map((c) => c._id);

  let moved = 0;
  if (readyIds.length > 0) {
    const result = await LedgerEntry.updateMany(
      { _id: { $in: readyIds }, status: 'on_hold' }, // re-check status — never downgrade an entry a concurrent run already moved past 'on_hold'
      { $set: { status: 'payable' } }
    );
    moved = result.modifiedCount || 0;
  }
  const stillWaitingOnCod = candidates.length - readyIds.length;
  console.log(`[ledgerMaturity] sweep: moved ${moved} entries to payable, ${stillWaitingOnCod} still waiting on COD reconciliation`);
  return { moved, stillWaitingOnCod };
}

function startLedgerMaturityJob() {
  if (timer) return;
  timer = setInterval(() => { runSweep().catch((err) => console.error('[ledgerMaturity] sweep failed:', err.message)); }, INTERVAL_MS);
  timer.unref?.();
}

function stopLedgerMaturityJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startLedgerMaturityJob, stopLedgerMaturityJob, runSweep };
