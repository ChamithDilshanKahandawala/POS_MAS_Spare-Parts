const Seller = require('../models/Seller');

// Blocks every write for a suspended/closed store — reads stay allowed
// (so a suspended seller can still see their own data and the banner
// explaining why they're locked out), only non-GET routes use this.
// requireSellerMember must run first (needs req.sellerId). A view-as
// session never reaches here on a write — requireSellerMember already
// 403s every non-GET for it before this middleware would run.
const requireActiveStore = async (req, res, next) => {
  const seller = await Seller.findById(req.sellerId).select('status').lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });
  if (seller.status === 'suspended' || seller.status === 'closed') {
    return res.status(403).json({ message: `This store is ${seller.status} — contact Apexora support to resolve this before making changes.` });
  }
  return next();
};

module.exports = requireActiveStore;
