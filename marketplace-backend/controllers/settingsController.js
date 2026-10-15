const PlatformSettings = require('../models/PlatformSettings');
const { logAction } = require('../services/auditLog');

// GET /api/admin/settings — any platform role can read; see routes for
// why only owner can save.
const getSettings = async (req, res) => {
  const settings = await PlatformSettings.findById('platform-settings') || await PlatformSettings.create({});
  res.json({ settings });
};

// PATCH /api/admin/settings — owner only. Every change is audited with a
// full before/after snapshot (not just the changed fields — this is a
// small singleton document, so there's no reason to diff it field by
// field).
const updateSettings = async (req, res) => {
  const settings = await PlatformSettings.findById('platform-settings') || await PlatformSettings.create({});
  const before = settings.toObject();

  Object.assign(settings, req.body);
  await settings.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'settings.update',
    targetType: 'PlatformSettings',
    targetId: settings._id,
    before,
    after: settings.toObject(),
    summary: `Updated platform settings`,
  });

  res.json({ settings });
};

module.exports = { getSettings, updateSettings };
