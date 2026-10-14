const { verifyAccessToken } = require('../services/tokens');
const User = require('../models/User');
const SellerMember = require('../models/SellerMember');

// Verifies the access token and attaches req.user (full Mongo doc, minus
// password). Every other middleware here assumes this already ran.
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password -otpCodeHash -refreshTokenHash');

    if (!user) return res.status(401).json({ message: 'User not found' });
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
};

// Platform-level role gate. requireAuth must run first.
const requirePlatform = (roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.platformRole)) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: platform role required' });
};

// Seller-level role gate. The seller ID comes ONLY from the caller's own
// memberships, never trusted from a route param — the client picks WHICH
// of its own stores via the X-Seller-Id header, it can never claim
// membership in a store it doesn't belong to. Not a member -> 404 (not
// 403), so a seller ID's mere existence is never confirmed to a caller
// who isn't on it.
const requireSellerMember = (roles) => async (req, res, next) => {
  try {
    const sellerId = req.headers['x-seller-id'];
    if (!sellerId) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const membership = await SellerMember.findOne({ user: req.user._id, seller: sellerId, status: 'active' });
    if (!membership) {
      return res.status(404).json({ message: 'Seller not found' });
    }
    if (!roles.includes(membership.role)) {
      return res.status(403).json({ message: 'Access denied: seller role required' });
    }

    req.sellerId = sellerId;
    req.sellerMember = membership;
    return next();
  } catch {
    // A malformed X-Seller-Id (not a valid ObjectId) is indistinguishable
    // from "not a member" to the caller — same 404, not a 500/400 that
    // would leak that the format was the problem.
    return res.status(404).json({ message: 'Seller not found' });
  }
};

module.exports = { requireAuth, requirePlatform, requireSellerMember };
