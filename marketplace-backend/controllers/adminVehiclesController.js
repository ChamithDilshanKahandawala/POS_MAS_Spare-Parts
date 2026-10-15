const VehicleMake = require('../models/VehicleMake');
const { logAction } = require('../services/auditLog');
const { clampLimit } = require('../utils/pagination');

const MAX_MAKES_LIMIT = 200;

// GET /api/admin/vehicles — every make (active or not), optional search.
const listMakes = async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const query = {};
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ name: { $regex: escaped, $options: 'i' } }, { 'models.name': { $regex: escaped, $options: 'i' } }];
  }

  const safeLimit = clampLimit(limit, 50, MAX_MAKES_LIMIT);
  const [makes, total] = await Promise.all([
    VehicleMake.find(query).sort({ name: 1 }).skip((page - 1) * safeLimit).limit(safeLimit),
    VehicleMake.countDocuments(query),
  ]);

  res.json({ makes, total, page: Number(page), pages: Math.ceil(total / safeLimit) });
};

// POST /api/admin/vehicles
const createMake = async (req, res) => {
  const existing = await VehicleMake.findOne({ name: req.body.name, type: req.body.type });
  if (existing) return res.status(409).json({ message: 'A make with this name and type already exists' });

  const make = await VehicleMake.create(req.body);

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'vehicleMake.create',
    targetType: 'VehicleMake',
    targetId: make._id,
    after: make.toObject(),
    summary: `Added vehicle make "${make.name}" (${make.type})`,
  });

  res.status(201).json({ make });
};

// PATCH /api/admin/vehicles/:id — basics (name/type/active) and/or
// wholesale-replaces `models`. Adding/editing/deactivating a model is
// always done by sending the full models array back — the console's
// vehicle editor always has the full list loaded already.
const updateMake = async (req, res) => {
  const make = await VehicleMake.findById(req.params.id);
  if (!make) return res.status(404).json({ message: 'Vehicle make not found' });

  const before = make.toObject();
  Object.assign(make, req.body);
  await make.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'vehicleMake.update',
    targetType: 'VehicleMake',
    targetId: make._id,
    before,
    after: make.toObject(),
    summary: `Updated vehicle make "${make.name}"`,
  });

  res.json({ make });
};

module.exports = { listMakes, createMake, updateMake };
