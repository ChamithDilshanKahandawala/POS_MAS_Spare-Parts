const mongoose = require('mongoose');

// A pending invitation — to join the platform staff (seller: null, role:
// 'platform_staff'), to become a seller's owner (seller: set, role:
// 'seller_owner'), or to join a seller's staff (seller: set, role:
// 'seller_staff') — same shape either way so the Platform Staff page,
// the application-approval flow, and the Seller Center's Staff page all
// share one acceptance endpoint (routes/publicRoutes.js). tokenHash (not
// the raw token) is stored — same reasoning as User.refreshTokenHash: a
// DB read alone can never yield a usable invite link.
const inviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['platform_staff', 'seller_owner', 'seller_staff'], required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null }, // set for seller_owner/seller_staff
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invite', inviteSchema);
