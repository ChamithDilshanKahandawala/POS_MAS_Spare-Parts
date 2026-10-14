const mongoose = require('mongoose');

// A store on the Apexora marketplace. Deliberately minimal for Milestone
// 0 — just enough for auth/role scoping (requireSellerMember,
// sellerScope) and the seed script to work with. Application/review
// fields (documents, verification notes, district, categories) belong to
// the seller-applications work (parked Milestone 1A), not here; adding
// them later only means adding fields, not changing what's already here.
const sellerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // store name
    legalName: { type: String, required: true, trim: true },
    brNumber: { type: String, required: true, trim: true },
    status: { type: String, enum: ['in_review', 'active', 'suspended', 'closed'], default: 'active' },

    // Optional overrides an admin can set later (Milestone 1A's seller
    // detail page) — present now so the schema doesn't need to change
    // when that's built, left unset by the Milestone 0 seed data.
    commissionOverridePct: { type: Number, default: null },
    probationUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Seller', sellerSchema);
