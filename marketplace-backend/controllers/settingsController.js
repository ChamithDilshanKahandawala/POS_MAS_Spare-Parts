const { logAction } = require('../services/auditLog');
const { getPlatformSettings } = require('../services/platformSettings');
const { getLongestActiveReturnWindowDays } = require('../services/categoryRules');

const DEV_TEST_ENVS = ['development', 'test'];

// Milestone 7 follow-up — payoutHoldDays gates how long a sale/commission
// entry sits on_hold before it can be paid out (services/ledger.js); set
// it shorter than an active category's real return window and a payout
// can go out before a legitimate return/dispute window has even closed.
// Two independent rules, checked whenever payoutHoldDays is part of this
// save (never retroactively re-checked just because a category's own
// return window changed later — only this save path, same as every other
// setting here):
//   1. 0 is a real value (skips the hold entirely) but only safe for
//      local iteration — never allowed outside development/test, no
//      matter what the categories say.
//   2. Any other value must be at least as long as the longest return
//      window any ACTIVE, returnable category can produce.
// Returns a user-facing message string if the value is rejected, or null
// if it's fine.
async function validatePayoutHoldDays(value) {
  if (value === 0) {
    if (!DEV_TEST_ENVS.includes(process.env.NODE_ENV)) {
      return 'Payout hold (days) cannot be 0 outside development/test — this would let a payout go out before any return window closes.';
    }
    return null;
  }
  const { maxWindowDays, category } = await getLongestActiveReturnWindowDays();
  if (value < maxWindowDays) {
    const categoryName = category?.name?.en || 'an active category';
    return `Payout hold (days) must be at least ${maxWindowDays} — "${categoryName}" has a ${maxWindowDays}-day return window.`;
  }
  return null;
}

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

  if (rest.payoutHoldDays !== undefined) {
    const reason = await validatePayoutHoldDays(rest.payoutHoldDays);
    if (reason) return res.status(400).json({ message: reason });
  }

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
