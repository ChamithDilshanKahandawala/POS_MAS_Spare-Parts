// Milestone 8 — Seller Center return handling. Scoped to req.sellerId by
// requireSellerMember, so another seller's return id 404s, same as orders.
const ReturnRequest = require('../models/ReturnRequest');
const { sellerRespond, markReceived } = require('../services/returns');
const { logAction } = require('../services/auditLog');
const { sendReturnPhoto } = require('./returnsHttp');

const LIST_LIMIT_MAX = 100;

// GET /api/seller/returns?status=&page=
const listReturns = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { seller: req.sellerId };
  if (status) filter.status = status;
  const safeLimit = Math.min(Number(limit) || 20, LIST_LIMIT_MAX);
  const [returns, total] = await Promise.all([
    ReturnRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit).lean(),
    ReturnRequest.countDocuments(filter),
  ]);
  res.json({ returns, total, page: Number(page), limit: safeLimit });
};

// GET /api/seller/returns/:id
const getReturn = async (req, res) => {
  const returnRequest = await ReturnRequest.findOne({ _id: req.params.id, seller: req.sellerId }).lean();
  if (!returnRequest) return res.status(404).json({ message: 'Return not found' });
  res.json({ returnRequest });
};

// POST /api/seller/returns/:id/respond — body: { accept: boolean, note }
const respond = async (req, res) => {
  const { accept, note } = req.body;
  const updated = await sellerRespond({
    sellerId: req.sellerId,
    returnId: req.params.id,
    actor: req.user,
    actorRole: req.sellerMember.role,
    accept,
    note,
  });

  await logAction({
    actor: req.user,
    actorRole: req.sellerMember.role,
    action: accept ? 'return.accept' : 'return.reject',
    targetType: 'ReturnRequest',
    targetId: updated._id,
    after: { status: updated.status },
    summary: `${accept ? 'Accepted' : 'Rejected'} return ${updated.requestNumber} for ${updated.orderNumber}`,
  });
  res.json({ returnRequest: updated });
};

// POST /api/seller/returns/:id/received
const received = async (req, res) => {
  const updated = await markReceived({
    sellerId: req.sellerId,
    returnId: req.params.id,
    actor: req.user,
    actorRole: req.sellerMember.role,
  });

  await logAction({
    actor: req.user,
    actorRole: req.sellerMember.role,
    action: 'return.received',
    targetType: 'ReturnRequest',
    targetId: updated._id,
    after: { status: updated.status },
    summary: `Confirmed item received for return ${updated.requestNumber} (${updated.orderNumber})`,
  });
  res.json({ returnRequest: updated });
};

// GET /api/seller/returns/:id/photos/:index
const getReturnPhoto = async (req, res) => {
  const returnRequest = await ReturnRequest.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!returnRequest) return res.status(404).json({ message: 'Return not found' });
  return sendReturnPhoto(res, returnRequest, req.params.index);
};

module.exports = { listReturns, getReturn, respond, received, getReturnPhoto };
