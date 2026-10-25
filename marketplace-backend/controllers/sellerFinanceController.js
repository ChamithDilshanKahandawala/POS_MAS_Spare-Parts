const mongoose = require('mongoose');
const LedgerEntry = require('../models/LedgerEntry');
const Payout = require('../models/Payout');
const SellerOrder = require('../models/SellerOrder');

function startOfMonth(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/seller/finance/balances — Part D's balance cards.
//
// req.sellerId is a STRING (every other seller controller in this
// project reads it the same way) — Model.find()/findOne() auto-cast a
// string against an ObjectId path, but Model.aggregate() does NOT walk
// the pipeline and cast $match values the way find() does, so every
// $match below explicitly wraps it in `new mongoose.Types.ObjectId(...)`.
// Skipping this is exactly the bug a previous round already hit once
// (Seller Orders tab counts silently showing 0 via an uncast
// aggregate $match) — never repeat it here.
const getBalances = async (req, res) => {
  const sellerId = new mongoose.Types.ObjectId(req.sellerId);
  const monthStart = startOfMonth(new Date());

  const [onHold, payable, inPayout, paidThisMonth] = await Promise.all([
    LedgerEntry.aggregate([{ $match: { seller: sellerId, status: 'on_hold' } }, { $group: { _id: null, total: { $sum: '$amountCents' } } }]),
    LedgerEntry.aggregate([{ $match: { seller: sellerId, status: 'payable' } }, { $group: { _id: null, total: { $sum: '$amountCents' } } }]),
    LedgerEntry.aggregate([{ $match: { seller: sellerId, status: 'in_payout' } }, { $group: { _id: null, total: { $sum: '$amountCents' } } }]),
    // "Paid this month" is what actually reached the seller — the
    // original sale/commission/charge/adjustment entries reaching 'paid'
    // this month, never the 'payout'/'payout_reversal' summary entries
    // themselves (those would double-count: a sale's +X and a payout's
    // -X both landing as 'paid' in the same month would otherwise net to
    // zero instead of showing what was actually received).
    LedgerEntry.aggregate([
      { $match: { seller: sellerId, status: 'paid', type: { $nin: ['payout', 'payout_reversal'] }, updatedAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amountCents' } } },
    ]),
  ]);

  res.json({
    onHoldCents: onHold[0]?.total || 0,
    payableCents: payable[0]?.total || 0,
    inPayoutCents: inPayout[0]?.total || 0,
    paidThisMonthCents: paidThisMonth[0]?.total || 0,
  });
};

// GET /api/seller/finance/ledger — Part D's filtered list. A plain
// find(), not aggregate() — Mongoose casts req.sellerId correctly here.
const getLedger = async (req, res) => {
  const { type, status, from, to, page = 1, limit = 50 } = req.query;
  const filter = { seller: req.sellerId };
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(200, Math.max(1, Number(limit)));

  const [entries, total] = await Promise.all([
    LedgerEntry.find(filter).populate('sellerOrder', 'orderNumber').sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    LedgerEntry.countDocuments(filter),
  ]);

  res.json({ entries, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
};

// GET /api/seller/finance/orders/:id — Part D's per-order breakdown
// (items total, commission with the rate shown, charges, net).
const getOrderBreakdown = async (req, res) => {
  const order = await SellerOrder.findOne({ _id: req.params.id, seller: req.sellerId })
    .select('orderNumber itemsTotalCents items refusedParcelCostCents deliveredAt status').lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const entries = await LedgerEntry.find({ sellerOrder: order._id }).sort({ createdAt: 1 }).lean();
  const commissionEntry = entries.find((e) => e.type === 'commission');
  const chargeEntry = entries.find((e) => e.type === 'refused_parcel_charge');

  // A single blended rate for display — commission can differ per line
  // (category/seller overrides), so this is itemsTotal-weighted, same
  // reasoning as controllers/adminFinanceController.js's by-category
  // breakdown; the per-line rates are still each shown in `items`.
  const commissionRateBps = order.itemsTotalCents > 0 && commissionEntry
    ? Math.round((Math.abs(commissionEntry.amountCents) / order.itemsTotalCents) * 10000)
    : null;

  res.json({
    orderNumber: order.orderNumber,
    itemsTotalCents: order.itemsTotalCents,
    items: order.items.map((i) => ({ title: i.title, qty: i.qty, lineTotalCents: i.lineTotalCents, commissionRateBps: i.commissionRateBps })),
    commissionCents: commissionEntry?.amountCents ?? null,
    commissionRateBps,
    chargesCents: chargeEntry?.amountCents ?? 0,
    netCents: entries.reduce((sum, e) => sum + e.amountCents, 0),
    entries,
  });
};

// GET /api/seller/finance/statements — Part D's weekly statements, one
// row per payout period this seller was included in (each PayoutRun's
// Payout document for them already IS a weekly period summary).
const getStatements = async (req, res) => {
  const payouts = await Payout.find({ seller: req.sellerId })
    .populate('payoutRun', 'weekKey periodStart periodEnd status')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ statements: payouts });
};

// GET /api/seller/finance/statements/:payoutId/export.csv
const exportStatementCsv = async (req, res) => {
  const payout = await Payout.findOne({ _id: req.params.payoutId, seller: req.sellerId }).populate('payoutRun', 'weekKey periodStart periodEnd').lean();
  if (!payout) return res.status(404).json({ message: 'Statement not found' });

  const header = ['Period', 'Gross sales (Rs.)', 'Commission (Rs.)', 'Charges (Rs.)', 'Adjustments (Rs.)', 'Net (Rs.)', 'Status'];
  const row = [
    payout.payoutRun?.weekKey || '',
    (payout.grossSalesCents / 100).toFixed(2),
    (payout.commissionCents / 100).toFixed(2),
    (payout.chargesCents / 100).toFixed(2),
    (payout.adjustmentsCents / 100).toFixed(2),
    (payout.netCents / 100).toFixed(2),
    payout.status,
  ];
  const csv = [header, row].map((r) => r.map(csvEscape).join(',')).join('\n');

  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="statement-${payout.payoutRun?.weekKey || payout._id}.csv"`);
  res.send(csv);
};

// GET /api/seller/finance/payouts — Part D's payout history.
const getPayoutHistory = async (req, res) => {
  const payouts = await Payout.find({ seller: req.sellerId })
    .populate('payoutRun', 'weekKey periodStart periodEnd')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ payouts });
};

module.exports = { getBalances, getLedger, getOrderBreakdown, getStatements, exportStatementCsv, getPayoutHistory };
