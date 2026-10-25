const PayoutRun = require('../models/PayoutRun');
const { logAction } = require('../services/auditLog');
const {
  generateDraftRun, getRunReview, removeSellerFromRun, approveRun, buildBankExportRows, markPaid, markFailed,
} = require('../services/payoutRuns');

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/admin/finance/payout-runs
const listRuns = async (req, res) => {
  const runs = await PayoutRun.find().sort({ createdAt: -1 }).limit(52).lean();
  res.json({ runs });
};

// POST /api/admin/finance/payout-runs — Part C.1, manual trigger (the
// weekly job calls services/payoutRuns.js's generateDraftRun() directly,
// not through this route).
const createRun = async (req, res) => {
  const run = await generateDraftRun({ createdBy: req.user._id });
  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.payout_run.create',
    targetType: 'PayoutRun', targetId: run._id,
    after: { weekKey: run.weekKey },
    summary: `${req.user.name} generated the payout run for ${run.weekKey}`,
  });
  res.status(201).json({ run });
};

// GET /api/admin/finance/payout-runs/:id — Part C.3's review screen.
const getRun = async (req, res) => {
  const review = await getRunReview(req.params.id);
  if (!review) return res.status(404).json({ message: 'Payout run not found' });
  res.json(review);
};

// DELETE /api/admin/finance/payout-runs/:id/sellers/:sellerId — Part C.3.
// Only legal on a still-draft run.
const removeSeller = async (req, res) => {
  const run = await PayoutRun.findById(req.params.id).lean();
  if (!run) return res.status(404).json({ message: 'Payout run not found' });
  if (run.status !== 'draft') return res.status(409).json({ message: 'This run is already approved and locked' });

  const payout = await removeSellerFromRun(req.params.id, req.params.sellerId);
  if (!payout) return res.status(404).json({ message: 'That seller is not in this run' });

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.payout_run.remove_seller',
    targetType: 'PayoutRun', targetId: run._id,
    before: { sellerId: req.params.sellerId, netCents: payout.netCents },
    summary: `${req.user.name} removed a seller from the ${run.weekKey} payout run — their entries are payable again`,
  });

  res.json({ message: 'Removed' });
};

// POST /api/admin/finance/payout-runs/:id/approve — Part C.4. Owner-only
// + fresh step-up (route middleware), audited. Locks the run.
const approve = async (req, res) => {
  const run = await approveRun(req.params.id, { approvedBy: req.user._id });
  if (!run) return res.status(409).json({ message: 'This run is already approved, or does not exist' });

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.payout_run.approve',
    targetType: 'PayoutRun', targetId: run._id,
    after: { status: 'approved' },
    summary: `${req.user.name} approved the ${run.weekKey} payout run`,
  });

  res.json({ run });
};

// GET /api/admin/finance/payout-runs/:id/export.csv — Part C.5. Owner-only
// + fresh step-up, audited, full account numbers ONLY here. Only an
// approved run's real (in_payout) payouts are exportable.
const exportBankCsv = async (req, res) => {
  const run = await PayoutRun.findById(req.params.id).lean();
  if (!run) return res.status(404).json({ message: 'Payout run not found' });
  if (run.status !== 'approved') return res.status(409).json({ message: 'Only an approved run can be exported' });

  const rows = await buildBankExportRows(req.params.id);

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.payout_run.export_bank_csv',
    targetType: 'PayoutRun', targetId: run._id,
    after: { rowCount: rows.length },
    summary: `${req.user.name} exported the bank file for the ${run.weekKey} payout run (${rows.length} payout(s), full account numbers)`,
  });

  const header = ['Seller', 'Bank', 'Branch', 'Account name', 'Account number', 'Amount (Rs.)', 'Reference'];
  const csvRows = rows.map((r) => [
    r.seller, r.bankName, r.branch, r.accountName, r.accountNumber, (r.amountCents / 100).toFixed(2), r.reference,
  ]);
  const csv = [header, ...csvRows].map((row) => row.map(csvEscape).join(',')).join('\n');

  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="payout-${run.weekKey}.csv"`);
  res.send(csv);
};

// POST /api/admin/finance/payouts/:id/mark-paid — Part C.6.
const markPaidRoute = async (req, res) => {
  const { bankReference, paidDate } = req.body;
  const payout = await markPaid(req.params.id, { bankReference, paidDate: paidDate ? new Date(paidDate) : undefined });
  if (!payout) return res.status(409).json({ message: 'This payout is not awaiting payment' });

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.payout.mark_paid',
    targetType: 'Payout', targetId: payout._id,
    after: { status: 'paid', bankReference },
    summary: `${req.user.name} marked a payout of Rs. ${(payout.netCents / 100).toFixed(2)} as paid (ref ${bankReference})`,
  });

  res.json({ payout });
};

// POST /api/admin/finance/payouts/:id/mark-failed — Part C.6.
const markFailedRoute = async (req, res) => {
  const { reason } = req.body;
  const payout = await markFailed(req.params.id, { reason });
  if (!payout) return res.status(409).json({ message: 'This payout is not awaiting payment' });

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.payout.mark_failed',
    targetType: 'Payout', targetId: payout._id,
    after: { status: 'failed', reason },
    summary: `${req.user.name} marked a payout of Rs. ${(payout.netCents / 100).toFixed(2)} as failed: ${reason}`,
  });

  res.json({ payout });
};

module.exports = {
  listRuns, createRun, getRun, removeSeller, approve, exportBankCsv, markPaidRoute, markFailedRoute,
};
