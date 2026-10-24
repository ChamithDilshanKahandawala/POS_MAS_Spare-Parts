const PlatformSettings = require('../models/PlatformSettings');
const { defaultDeliveryRates } = require('../models/PlatformSettings');

// The one place every caller gets the platform-settings singleton from.
// Mongoose schema defaults only ever apply when a document is first
// CREATED — they're never retroactively backfilled onto a document that
// already existed before a field was added to the schema (exactly what
// happened here: dev/prod's platform-settings row was created back in
// Milestone 2, long before deliveryRates/onlineOrderingEnabled/
// autoCancelAfterHours existed). A plain findById().lean() would
// therefore silently return deliveryRates: undefined on that real row,
// which services/deliveryFee.js would then throw on. This backfills
// deliveryRates once (persisted, not just patched onto the return value)
// the first time anything asks for settings after this migration, so
// every caller downstream can keep assuming it's always present.
async function getPlatformSettings() {
  let settings = await PlatformSettings.findById('platform-settings');
  if (!settings) settings = await PlatformSettings.create({});
  if (!settings.deliveryRates || Object.keys(settings.deliveryRates).length === 0) {
    settings.deliveryRates = defaultDeliveryRates();
    settings.markModified('deliveryRates');
    await settings.save();
  }
  return settings;
}

module.exports = { getPlatformSettings };
