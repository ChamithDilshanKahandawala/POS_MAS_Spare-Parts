const Seller = require('../models/Seller');
const { logAction } = require('../services/auditLog');
const { stripFullAccountNumber } = require('../utils/sanitizeSeller');
const { generateUniqueSlug } = require('../services/sellerSlug');

// GET /api/seller/me/store — any member (owner or staff) of the seller
// named in X-Seller-Id. requireSellerMember has already confirmed
// membership and set req.sellerId, so this is a plain findById — NOT
// sellerScope() (services/sellerScope.js), which applies `{seller:
// req.sellerId}` as a filter for collections that *reference* a seller
// (future Product/Order models etc.). Seller documents don't have a
// `seller` field on themselves — they *are* the seller — so running them
// through sellerScope() silently matched nothing and 404'd for every
// valid member, caught by the test suite (both the owner and staff
// "succeeds for store A" cases failed until this was fixed).
const getMyStore = async (req, res) => {
  const seller = await Seller.findById(req.sellerId);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });
  res.json({ seller: stripFullAccountNumber(seller), myRole: req.sellerMember.role });
};

// Dummy owner-only route — exists purely to prove requireSellerMember's
// role check (not just membership) actually gates access: seller_staff
// must get 403 here while seller_owner gets 200.
const ownerOnlyPing = async (req, res) => {
  res.json({ message: 'owner-only route reached', sellerId: req.sellerId });
};

// PATCH /api/seller/me/store — the Store settings "Profile" section:
// display name, about text (en/si/ta), phones, WhatsApp, email,
// operating hours, district, address, return address. Never
// legalName/brNumber/status/commissionOverridePct/probationUntil/
// bankAccount etc. — those aren't in routes/sellerRoutes.js's .strict()
// schema at all, so sending them is a 400 (unknown field), never
// silently ignored. Also the route requireActiveStore gates — a
// suspended/closed store gets 403 here before this handler ever runs.
const updateMyStore = async (req, res) => {
  const before = await Seller.findById(req.sellerId);
  if (!before) return res.status(404).json({ message: 'Seller not found' });

  const patch = { ...req.body };
  if (patch.displayName && patch.displayName.trim() && patch.displayName.trim() !== before.displayName) {
    patch.slug = await generateUniqueSlug(patch.displayName, before._id);
  }

  const seller = await Seller.findByIdAndUpdate(req.sellerId, patch, { new: true });

  await logAction({
    actor: req.user,
    actorRole: req.sellerMember.role,
    action: 'seller.profile.update',
    targetType: 'Seller',
    targetId: seller._id,
    before: Object.fromEntries(Object.keys(req.body).map((k) => [k, before[k]])),
    after: Object.fromEntries(Object.keys(req.body).map((k) => [k, seller[k]])),
    summary: `${req.user.name} updated the store profile`,
  });

  res.json({ seller: stripFullAccountNumber(seller), myRole: req.sellerMember.role });
};

module.exports = { getMyStore, ownerOnlyPing, updateMyStore };
