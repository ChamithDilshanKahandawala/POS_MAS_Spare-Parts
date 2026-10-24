const { logAction } = require('../services/auditLog');
const { getPlatformSettings } = require('../services/platformSettings');

// GET /api/admin/settings — any platform role can read; see routes for
// why only owner can save.
const getSettings = async (req, res) => {
  const settings = await getPlatformSettings();
  res.json({ settings: settings.toObject() });
};

// PATCH /api/admin/settings — owner only. Every change is audited with a
// full before/after snapshot (not just the changed fields — this is a
// small singleton document, so there's no reason to diff it field by
// field).
const updateSettings = async (req, res) => {
  const settings = await getPlatformSettings();
  const before = settings.toObject();

  // deliveryRates is merged district-by-district, never replaced whole —
  // the admin Settings page sends only the districts it actually changed
  // (Milestone 6 Part B), and a plain Object.assign of the top-level key
  // would otherwise silently wipe every other district's rate back to
  // undefined. Every other settings field is a flat scalar/array, so a
  // normal shallow Object.assign is correct for the rest of req.body.
  const { deliveryRates, ...rest } = req.body;
  Object.assign(settings, rest);
  if (deliveryRates) {
    settings.deliveryRates = { ...(settings.deliveryRates || {}), ...deliveryRates };
    settings.markModified('deliveryRates');
  }
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
