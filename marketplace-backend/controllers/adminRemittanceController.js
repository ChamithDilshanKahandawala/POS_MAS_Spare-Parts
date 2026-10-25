const CourierColumnMapping = require('../models/CourierColumnMapping');
const CodRemittanceRow = require('../models/CodRemittanceRow');
const { logAction } = require('../services/auditLog');
const { processRemittanceUpload } = require('../services/remittance');

// GET /api/admin/finance/remittances/mapping/:courier
const getMapping = async (req, res) => {
  const mapping = await CourierColumnMapping.findOne({ courierName: req.params.courier }).lean();
  res.json({ mapping });
};

// PUT /api/admin/finance/remittances/mapping/:courier — Part B.1,
// owner-only (routes/adminRoutes.js). Upsert — the column layout for a
// courier either doesn't exist yet or is being corrected, never both at
// once.
const saveMapping = async (req, res) => {
  const { trackingNumberColumn, codAmountColumn, remittanceDateColumn, referenceColumn } = req.body;
  const before = await CourierColumnMapping.findOne({ courierName: req.params.courier }).lean();

  const mapping = await CourierColumnMapping.findOneAndUpdate(
    { courierName: req.params.courier },
    { $set: { trackingNumberColumn, codAmountColumn, remittanceDateColumn, referenceColumn, updatedBy: req.user._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.remittance_mapping.save',
    targetType: 'CourierColumnMapping', targetId: mapping._id,
    before, after: mapping.toObject(),
    summary: `${req.user.name} ${before ? 'updated' : 'set up'} the column mapping for ${req.params.courier}`,
  });

  res.json({ mapping });
};

// POST /api/admin/finance/remittances/upload — multipart, field name
// "file" + body field "courierName". Part B.2/B.4.
const uploadRemittance = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const { courierName } = req.body;

  const { uploadBatchId, summary, results } = await processRemittanceUpload({
    courierName,
    fileText: req.file.buffer.toString('utf8'),
    uploadedBy: req.user._id,
  });

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'finance.remittance.upload',
    targetType: 'CodRemittanceRow', targetId: uploadBatchId,
    after: summary,
    summary: `${req.user.name} uploaded a ${courierName} remittance file: ${summary.matched} matched, ${summary.short} short, ${summary.over} over, ${summary.unknownTracking} unknown, ${summary.duplicate} duplicate, ${summary.errors} errors`,
  });

  res.json({ uploadBatchId, summary, results });
};

// GET /api/admin/finance/remittances — list, filterable.
const listRemittances = async (req, res) => {
  const { courierName, matchStatus, from, to, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (courierName) filter.courierName = courierName;
  if (matchStatus) filter.matchStatus = matchStatus;
  if (from || to) {
    filter.remittanceDate = {};
    if (from) filter.remittanceDate.$gte = new Date(from);
    if (to) filter.remittanceDate.$lte = new Date(to);
  }
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(200, Math.max(1, Number(limit)));

  const [rows, total] = await Promise.all([
    CodRemittanceRow.find(filter).populate('sellerOrder', 'orderNumber seller').sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    CodRemittanceRow.countDocuments(filter),
  ]);

  res.json({ rows, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
};

module.exports = { getMapping, saveMapping, uploadRemittance, listRemittances };
