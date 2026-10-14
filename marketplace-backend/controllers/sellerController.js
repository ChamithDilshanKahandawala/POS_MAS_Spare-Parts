const Seller = require('../models/Seller');

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
  res.json({ seller, myRole: req.sellerMember.role });
};

// Dummy owner-only route — exists purely to prove requireSellerMember's
// role check (not just membership) actually gates access: seller_staff
// must get 403 here while seller_owner gets 200.
const ownerOnlyPing = async (req, res) => {
  res.json({ message: 'owner-only route reached', sellerId: req.sellerId });
};

module.exports = { getMyStore, ownerOnlyPing };
