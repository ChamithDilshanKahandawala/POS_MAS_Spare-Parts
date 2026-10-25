const mongoose = require('mongoose');
const PayoutRun = require('../models/PayoutRun');
const Payout = require('../models/Payout');
const LedgerEntry = require('../models/LedgerEntry');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const { getPlatformSettings } = require('./platformSettings');
const { notify } = require('./notifications');

async function ownerUserId(sellerId) {
  const owner = await SellerMember.findOne({ seller: sellerId, role: 'seller_owner', status: 'active' }).select('user').lean();
  return owner?.user || null;
}

// Standard ISO-8601 week key ("2026-W04") — the periodEnd date's week,
// computed in UTC so this never depends on the server's local timezone.
// Used as PayoutRun's unique idempotency key (Part C.1/C.7): "generating
// the same week's run twice gives one run."
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday decides the ISO year
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  const weekNum = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + firstThursdayDayNum) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function emptyTotals() {
  return { grossSalesCents: 0, commissionCents: 0, chargesCents: 0, adjustmentsCents: 0 };
}

function addEntryToTotals(totals, entry) {
  if (entry.type === 'sale') totals.grossSalesCents += entry.amountCents;
  else if (entry.type === 'commission') totals.commissionCents += entry.amountCents;
  else if (entry.type === 'refused_parcel_charge' || entry.type === 'delivery_fee_seller') totals.chargesCents += entry.amountCents;
  else if (entry.type === 'adjustment') totals.adjustmentsCents += entry.amountCents;
  return totals;
}

// Milestone 7 Part C.1/C.2 — the weekly (or manually-triggered) draft
// generation. Everything below runs inside ONE transaction, same
// retry-on-transient-conflict shape as services/orderCreation.js's
// placeOrder: a second concurrent call for the SAME week either (a)
// loses the PayoutRun.weekKey unique-index race and its whole
// transaction — including any LedgerEntry claims it made — rolls back
// together, satisfying "no entry in two payouts" without any extra
// locking, or (b) hits a storage-level WriteConflict on a seller's
// contested LedgerEntry rows and retries from scratch.
async function generateDraftRun({ createdBy = null, now = new Date() } = {}) {
  const weekKey = isoWeekKey(now);

  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const run = await attemptGenerate({ weekKey, createdBy, now, session });
      await session.commitTransaction();
      return run;
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      if (err.code === 11000) {
        const existing = await PayoutRun.findOne({ weekKey }).lean();
        if (existing) return existing;
      }
      const isTransient = err.hasErrorLabel?.('TransientTransactionError') || err.errorLabelSet?.has?.('TransientTransactionError') || err.code === 112;
      if (isTransient && attempt < MAX_ATTEMPTS) continue;
      throw err;
    } finally {
      session.endSession();
    }
  }
  throw new Error('Could not generate payout run after repeated transient conflicts — please try again');
}

async function attemptGenerate({ weekKey, createdBy, now, session }) {
  const settings = await getPlatformSettings();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Created FIRST and inside the same transaction as everything else —
  // if this throws (another request already won this week), nothing
  // below it ever gets a chance to claim a single ledger entry.
  const [run] = await PayoutRun.create([{ weekKey, periodStart, periodEnd, status: 'draft', createdBy }], { session });

  const eligibleSellerIds = await LedgerEntry.aggregate([
    { $match: { status: 'payable' } },
    { $group: { _id: '$seller', balance: { $sum: '$amountCents' } } },
    { $match: { balance: { $gte: settings.minimumPayoutCents } } },
  ]).session(session);

  for (const { _id: sellerId } of eligibleSellerIds) {
     
    const seller = await Seller.findById(sellerId).select('settlementMode bankAccount').session(session);
     
    const payableEntries = await LedgerEntry.find({ seller: sellerId, status: 'payable' }).session(session);

    const totals = payableEntries.reduce(addEntryToTotals, emptyTotals());
    const netCents = totals.grossSalesCents + totals.commissionCents + totals.chargesCents + totals.adjustmentsCents;
    const entryIds = payableEntries.map((e) => e._id);

    const isInternal = seller.settlementMode === 'internal';
    const bankVerified = seller.bankAccount?.status === 'verified';

    let status;
    if (isInternal) status = 'settled_internally';
    else if (!bankVerified) status = 'blocked';
    else status = 'in_payout';

     
    const [payout] = await Payout.create([{
      payoutRun: run._id,
      seller: sellerId,
      status,
      settlementMode: seller.settlementMode,
      ...totals,
      netCents,
      entries: status === 'blocked' ? [] : entryIds,
      bankSnapshot: isInternal || !bankVerified ? undefined : {
        bankName: seller.bankAccount.bankName,
        branch: seller.bankAccount.branch,
        accountName: seller.bankAccount.accountName,
        last4: seller.bankAccount.last4,
      },
    }], { session });

    if (status === 'blocked') continue; // entries stay exactly as 'payable' — nothing claimed

    if (status === 'settled_internally') {
       
      await LedgerEntry.updateMany(
        { _id: { $in: entryIds }, status: 'payable' },
        { $set: { status: 'paid', payout: payout._id } },
        { session }
      );
       
      await LedgerEntry.create([{
        seller: sellerId, type: 'payout', amountCents: -netCents, payout: payout._id,
        status: 'paid', availableAt: now, reason: 'Settled internally',
      }], { session });
      continue;
    }

    // Real payout, pending — claim the entries. The filter re-checking
    // status:'payable' at write time is what actually prevents "an entry
    // in two payouts" under a genuine race on a DIFFERENT week's
    // transaction reading stale data; combined with transaction snapshot
    // isolation, two concurrent runs touching the same seller can't both
    // succeed in claiming the same entries.
     
    await LedgerEntry.updateMany(
      { _id: { $in: entryIds }, status: 'payable' },
      { $set: { status: 'in_payout', payout: payout._id } },
      { session }
    );
  }

  return run;
}

async function getRunReview(runId) {
  const run = await PayoutRun.findById(runId).lean();
  if (!run) return null;
  const payouts = await Payout.find({ payoutRun: runId })
    .populate('seller', 'name displayName settlementMode')
    .sort({ netCents: -1 })
    .lean();
  return { run, payouts };
}

// Part C.3 — "The owner can remove a seller from the run (entries go
// back to payable)." Only legal while the run is still 'draft' — once
// approved the run is locked (checked by the controller before this is
// even called, same as every other owner-only action's step-up check).
async function removeSellerFromRun(runId, sellerId) {
  const payout = await Payout.findOne({ payoutRun: runId, seller: sellerId });
  if (!payout) return null;
  if (payout.status === 'in_payout') {
    await LedgerEntry.updateMany(
      { _id: { $in: payout.entries }, status: 'in_payout', payout: payout._id },
      { $set: { status: 'payable' }, $unset: { payout: '' } }
    );
  }
  await Payout.deleteOne({ _id: payout._id });
  return payout;
}

async function approveRun(runId, { approvedBy }) {
  const run = await PayoutRun.findOneAndUpdate(
    { _id: runId, status: 'draft' },
    { $set: { status: 'approved', approvedBy, approvedAt: new Date() } },
    { new: true }
  );
  return run; // null if already approved (or missing) — controller turns that into a 409/404
}

// Part C.5 — the ONLY place a full bank account number is ever read for
// payout purposes; always fetched live from Seller (never from
// Payout.bankSnapshot, which only ever holds last4), and only for an
// approved run's still-in_payout (real, non-internal, non-blocked)
// payouts. Caller (controllers/adminPayoutController.js) gates this
// behind requireFreshStepUp and writes the audit entry — this function
// itself does neither, so it can't accidentally be called from
// somewhere that skips that.
async function buildBankExportRows(runId) {
  const payouts = await Payout.find({ payoutRun: runId, status: 'in_payout' })
    .populate({ path: 'seller', select: '+bankAccount.accountNumber name displayName' })
    .lean();
  return payouts.map((p) => ({
    seller: p.seller.displayName || p.seller.name,
    bankName: p.seller.bankAccount.bankName,
    branch: p.seller.bankAccount.branch,
    accountName: p.seller.bankAccount.accountName,
    accountNumber: p.seller.bankAccount.accountNumber,
    amountCents: p.netCents,
    reference: `Apexora payout ${String(p._id)}`,
  }));
}

// Part C.6 — success path. Entries -> 'paid', a 'payout' ledger entry
// records the actual debit, seller notified.
async function markPaid(payoutId, { bankReference, paidDate }) {
  const payout = await Payout.findOneAndUpdate(
    { _id: payoutId, status: 'in_payout' },
    { $set: { status: 'paid', paidAt: paidDate || new Date(), paidReference: bankReference } },
    { new: true }
  );
  if (!payout) return null;

  await LedgerEntry.updateMany(
    { _id: { $in: payout.entries }, status: 'in_payout' },
    { $set: { status: 'paid' } }
  );
  await LedgerEntry.create({
    seller: payout.seller, type: 'payout', amountCents: -payout.netCents, payout: payout._id,
    status: 'paid', availableAt: payout.paidAt, reason: `Paid — ref ${bankReference}`,
  });
  const ownerId = await ownerUserId(payout.seller);
  if (ownerId) {
    await notify({
      userId: ownerId,
      type: 'payout.paid',
      title: `Payout of Rs. ${(payout.netCents / 100).toFixed(2)} sent`,
      body: `Bank reference: ${bankReference}`,
      link: '/seller/finance',
    });
  }
  return payout;
}

// Part C.6 — failure path. The attempted transfer never landed, so the
// earmarked entries go back to 'payable' (free to be swept into the
// NEXT run) and a 'payout_reversal' entry records that this attempt
// didn't go through.
async function markFailed(payoutId, { reason }) {
  const payout = await Payout.findOneAndUpdate(
    { _id: payoutId, status: 'in_payout' },
    { $set: { status: 'failed', failedAt: new Date(), failedReason: reason } },
    { new: true }
  );
  if (!payout) return null;

  await LedgerEntry.updateMany(
    { _id: { $in: payout.entries }, status: 'in_payout', payout: payout._id },
    { $set: { status: 'payable' }, $unset: { payout: '' } }
  );
  await LedgerEntry.create({
    seller: payout.seller, type: 'payout_reversal', amountCents: payout.netCents, payout: payout._id,
    status: 'paid', availableAt: new Date(), reason: `Payout failed: ${reason}`,
  });
  const ownerId = await ownerUserId(payout.seller);
  if (ownerId) {
    await notify({
      userId: ownerId,
      type: 'payout.failed',
      title: `A payout of Rs. ${(payout.netCents / 100).toFixed(2)} failed`,
      body: reason,
      link: '/seller/finance',
    });
  }
  return payout;
}

// Part C.1 — "Weekly on platform setting payoutDayOfWeek, a job creates
// a DRAFT payout run." Checked once a day (same shape as every other
// scheduled job in this project — see orderAutoCancel.js/
// posRecordedReminder.js for why none of these use a real cron
// dependency); on a day that isn't the configured one this is a no-op.
// Safe to fire more than once on the matching day (a restart, say) —
// generateDraftRun()'s own weekKey uniqueness makes a second call that
// same week a harmless no-op that returns the already-existing run.
const JOB_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
let jobTimer = null;

async function checkAndGenerateWeeklyRun() {
  const settings = await getPlatformSettings();
  if (new Date().getDay() !== settings.payoutDayOfWeek) return;
  const run = await generateDraftRun();
  console.log(`[payoutRuns] weekly job: draft run ${run.weekKey} ready`);
}

function startPayoutRunJob() {
  if (jobTimer) return;
  jobTimer = setInterval(() => {
    checkAndGenerateWeeklyRun().catch((err) => console.error('[payoutRuns] weekly job failed:', err.message));
  }, JOB_CHECK_INTERVAL_MS);
  jobTimer.unref?.();
}

function stopPayoutRunJob() {
  if (jobTimer) clearInterval(jobTimer);
  jobTimer = null;
}

module.exports = {
  isoWeekKey, generateDraftRun, getRunReview, removeSellerFromRun,
  approveRun, buildBankExportRows, markPaid, markFailed,
  startPayoutRunJob, stopPayoutRunJob, checkAndGenerateWeeklyRun,
};
