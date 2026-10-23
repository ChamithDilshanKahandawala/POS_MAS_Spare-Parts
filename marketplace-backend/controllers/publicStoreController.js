const Seller = require('../models/Seller');
const { readFile } = require('../services/storage');

// Only ever an ACTIVE seller — in_review/suspended/closed stores have no
// public page, same visibility reasoning as publicListingsController.js's
// visibilityFilter(). Deliberately whitelists fields rather than
// excluding them: documents/bankAccount/posConnection/nic/application/
// verificationNotes/commissionOverridePct/probationUntil/reviewExempt
// must never reach here even if the Seller schema grows new internal
// fields later.
function toPublicStore(seller) {
  return {
    id: seller._id,
    name: seller.displayName || seller.name,
    slug: seller.slug,
    district: seller.district,
    aboutText: seller.aboutText,
    phones: seller.phones,
    whatsapp: seller.whatsapp,
    operatingHours: seller.operatingHours,
    hasLogo: !!seller.logo?.path,
    hasBanner: !!seller.banner?.path,
  };
}

// GET /api/public/stores/:slug
const getStorePage = async (req, res) => {
  const seller = await Seller.findOne({ slug: req.params.slug, status: 'active' }).lean();
  if (!seller) return res.status(404).json({ message: 'Store not found' });
  res.json({ store: toPublicStore(seller) });
};

function getPublicMediaHandlerFor(field) {
  return async (req, res) => {
    const seller = await Seller.findOne({ slug: req.params.slug, status: 'active' }).select(field).lean();
    if (!seller || !seller[field]?.path) return res.status(404).json({ message: 'Not found' });
    res.set('Content-Type', 'image/jpeg');
    res.send(readFile(seller[field].path));
  };
}

// GET /api/public/stores/:slug/logo, GET /api/public/stores/:slug/banner
const getStoreLogo = getPublicMediaHandlerFor('logo');
const getStoreBanner = getPublicMediaHandlerFor('banner');

module.exports = { getStorePage, getStoreLogo, getStoreBanner };
