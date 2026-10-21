const Listing = require('../models/Listing');
const SellerMember = require('../models/SellerMember');
const { getEffectiveCategory, getDescendantAndSelfIds } = require('./categoryRules');
const { notify } = require('./notifications');

const LIVE_STATUSES = ['published', 'hidden', 'suspended'];

function attributesMissingRequired(listing, effectiveFields) {
  for (const field of effectiveFields) {
    if (field.type === 'fitment') {
      if (field.required && (!listing.fitment || listing.fitment.length === 0)) return true;
      continue;
    }
    if (!field.required) continue;
    const value = listing.attributes?.[field.key];
    const isEmpty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (isEmpty) return true;
  }
  return false;
}

// Called right after a category's attributeSchema changes
// (controllers/adminCategoriesController.js's updateCategory, once the
// schemaVersion bump has already been saved). Walks every descendant
// category (inherited fields reach them too), flags any live listing
// there that's now missing a required field, and notifies each affected
// seller once. "stays published" — this only ever sets needsUpdate, never
// touches status.
async function flagListingsForCategoryChange(categoryId) {
  const affectedCategoryIds = await getDescendantAndSelfIds(categoryId);
  const listings = await Listing.find({ categoryId: { $in: affectedCategoryIds }, status: { $in: LIVE_STATUSES } });
  if (listings.length === 0) return { flagged: 0 };

  const effectiveCache = new Map();
  const flaggedBySeller = new Map();

  for (const listing of listings) {
    const catKey = String(listing.categoryId);
    if (!effectiveCache.has(catKey)) {
      effectiveCache.set(catKey, await getEffectiveCategory(listing.categoryId));
    }
    const resolved = effectiveCache.get(catKey);
    if (!resolved) continue;

    const alreadyCurrent = listing.categorySchemaVersion === resolved.category.schemaVersion && !attributesMissingRequired(listing, resolved.effective.attributeSchema);
    if (alreadyCurrent) continue;
    if (!attributesMissingRequired(listing, resolved.effective.attributeSchema)) {
      // Schema version moved but nothing this listing needs changed —
      // just record the new version, no need to bother the seller.
      listing.categorySchemaVersion = resolved.category.schemaVersion;
      await listing.save();
      continue;
    }

    listing.needsUpdate = true;
    listing.categorySchemaVersion = resolved.category.schemaVersion;
    await listing.save();

    const sellerKey = String(listing.seller);
    flaggedBySeller.set(sellerKey, (flaggedBySeller.get(sellerKey) || 0) + 1);
  }

  for (const [sellerId, count] of flaggedBySeller) {
    const members = await SellerMember.find({ seller: sellerId, status: 'active' }).lean();
    await Promise.all(members.map((m) => notify({
      userId: m.user,
      type: 'listing.needs_update',
      title: count === 1 ? '1 listing needs an update' : `${count} listings need an update`,
      body: 'A category you list in now requires a field your listing doesn\'t have yet. It\'s still live — please update it when you can.',
      link: '/seller/products?status=needs_update',
    })));
  }

  return { flagged: flaggedBySeller.size };
}

module.exports = { flagListingsForCategoryChange };
