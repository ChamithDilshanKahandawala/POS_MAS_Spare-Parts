// Milestone 8 — a customer's own return requests. Every route scopes to
// req.user._id; a return id from another customer simply 404s.
const { z } = require('zod');
const ReturnRequest = require('../models/ReturnRequest');
const { REASONS } = require('../models/ReturnRequest');
const { createReturnRequest } = require('../services/returns');
const { processReturnPhoto } = require('../services/imageProcessing');
const { saveFile, deleteFile } = require('../services/storage');
const { sendReturnPhoto } = require('./returnsHttp');

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const MAX_PHOTOS = 5;

const createBodySchema = z.object({
  sellerOrderId: z.string().regex(OBJECT_ID_RE),
  reason: z.enum(REASONS),
  customerNote: z.string().trim().max(1000).optional().default(''),
  lines: z.array(z.object({
    itemId: z.string().regex(OBJECT_ID_RE),
    qty: z.number().int().min(1).max(999),
  }).strict()).min(1).max(50),
}).strict();

// POST /api/customer/returns — multipart: JSON fields plus up to 5 photos.
const createReturn = async (req, res) => {
  let lines;
  try {
    lines = JSON.parse(req.body.lines || '[]');
  } catch {
    return res.status(400).json({ message: 'Invalid list of items' });
  }

  const parsed = createBodySchema.safeParse({
    sellerOrderId: req.body.sellerOrderId,
    reason: req.body.reason,
    customerNote: req.body.customerNote,
    lines,
  });
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

  const files = req.files || [];
  if (files.length > MAX_PHOTOS) return res.status(400).json({ message: `You can attach up to ${MAX_PHOTOS} photos` });

  const processed = await Promise.all(files.map((f) => processReturnPhoto(f.buffer)));
  if (processed.some((p) => !p)) return res.status(400).json({ message: 'Each photo must be a real JPG, PNG, or WebP image' });
  const photoPaths = processed.map((p) => saveFile(p.buffer, p.ext, 'return-photos'));

  try {
    const request = await createReturnRequest({
      customerId: req.user._id,
      sellerOrderId: parsed.data.sellerOrderId,
      reason: parsed.data.reason,
      customerNote: parsed.data.customerNote,
      lines: parsed.data.lines,
      photoPaths,
    });
    return res.status(201).json({ returnRequest: request });
  } catch (err) {
    photoPaths.forEach(deleteFile);
    throw err;
  }
};

// GET /api/customer/returns
const listMyReturns = async (req, res) => {
  const returns = await ReturnRequest.find({ customer: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ returns });
};

// GET /api/customer/returns/:id
const getMyReturn = async (req, res) => {
  const returnRequest = await ReturnRequest.findOne({ _id: req.params.id, customer: req.user._id }).lean();
  if (!returnRequest) return res.status(404).json({ message: 'Return not found' });
  res.json({ returnRequest });
};

// GET /api/customer/returns/:id/photos/:index
const getMyReturnPhoto = async (req, res) => {
  const returnRequest = await ReturnRequest.findOne({ _id: req.params.id, customer: req.user._id });
  if (!returnRequest) return res.status(404).json({ message: 'Return not found' });
  return sendReturnPhoto(res, returnRequest, req.params.index);
};

module.exports = { createReturn, listMyReturns, getMyReturn, getMyReturnPhoto };
