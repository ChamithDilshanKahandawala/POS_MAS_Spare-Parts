// Milestone 8 — platform review of returns. Deciding is open to platform
// staff; marking a refund paid moves money, so it is owner-only and gated by
// a fresh step-up in adminRoutes.js.
const ReturnRequest = require('../models/ReturnRequest');
const { adminDecide, markRefunded } = require('../services/returns');
const { logAction } = require('../services/auditLog');
const { sendReturnPhoto } = require('./returnsHttp');

// The default queue: every return that still needs a platform decision or a
// refund action, oldest first.
const QUEUE_STATUSES = ['seller_rejected', 'escalated', 'admin_decided', 'seller_accepted', 'item_returned'];

// GET /api/admin/returns?status=&page=
const listReturns = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = status ? { status } : { status: { $in: QUEUE_STATUSES } };
  const safeLimit = Math.min(Number(limit) || 20, 100);
  const [returns, total] = await Promise.all([
    ReturnRequest.find(filter).sort({ updatedAt: 1 }).skip((page - 1) * safeLimit).limit(safeLimit).lean(),
    ReturnRequest.countDocuments(filter),
  ]);
  res.json({ returns, total, page: Number(page), limit: safeLimit });
};

// GET /api/admin/returns/:id
const getReturn = async (req, res) => {
  const returnRequest = await ReturnRequest.findById(req.params.id).populate('seller', 'name slug').lean();
  if (!returnRequest) return res.status(404).json({ message: 'Return not found' });
  res.json({ returnRequest });
};

// POST /api/admin/returns/:id/decide — body: { decision: 'uphold'|'dismiss', note }
const decide = async (req, res) => {
  const { decision, note } = req.body;
  const updated = await adminDecide({
    returnId: req.params.id,
    actor: req.user,
    actorRole: req.user.platformRole,
    uphold: decision === 'uphold',
    note,
  });

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'return.decide',
    targetType: 'ReturnRequest',
    targetId: updated._id,
    after: { status: updated.status, decision: updated.decision },
    summary: `${decision === 'uphold' ? 'Upheld' : 'Dismissed'} return ${updated.requestNumber} for ${updated.orderNumber}`,
  });
  res.json({ returnRequest: updated });
};

// POST /api/admin/returns/:id/refund — body: { payer, shippingCents, method, reference }
const refund = async (req, res) => {
  const { payer, shippingCents, method, reference } = req.body;
  const updated = await markRefunded({
    returnId: req.params.id,
    actor: req.user,
    actorRole: req.user.platformRole,
    payer,
    shippingCents,
    method,
    reference,
  });

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'return.refund',
    targetType: 'ReturnRequest',
    targetId: updated._id,
    after: {
      status: updated.status,
      customerRefundCents: updated.resolution.customerRefundCents,
      returnShippingPayer: payer,
      returnShippingCents: shippingCents,
      refundMethod: method,
    },
    summary: `Marked return ${updated.requestNumber} refunded (${method}, ref ${reference})`,
  });
  res.json({ returnRequest: updated });
};

// GET /api/admin/returns/:id/photos/:index
const getReturnPhoto = async (req, res) => {
  const returnRequest = await ReturnRequest.findById(req.params.id);
  if (!returnRequest) return res.status(404).json({ message: 'Return not found' });
  return sendReturnPhoto(res, returnRequest, req.params.index);
};

module.exports = { listReturns, getReturn, decide, refund, getReturnPhoto };
