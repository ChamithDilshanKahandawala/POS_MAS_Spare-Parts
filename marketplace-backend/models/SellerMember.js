const mongoose = require('mongoose');

// Join table: which users belong to which sellers, and in what role.
// requireSellerMember reads this (scoped by the authenticated user +
// X-Seller-Id header) to decide membership and role — never anything the
// client asserts directly.
const sellerMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
    role: { type: String, enum: ['seller_owner', 'seller_staff'], required: true },
    status: { type: String, enum: ['active', 'removed'], default: 'active' },
  },
  { timestamps: true }
);

// A user can only have one membership row per seller.
sellerMemberSchema.index({ user: 1, seller: 1 }, { unique: true });

module.exports = mongoose.model('SellerMember', sellerMemberSchema);
