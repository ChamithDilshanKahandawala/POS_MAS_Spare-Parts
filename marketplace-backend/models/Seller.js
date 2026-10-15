const mongoose = require('mongoose');

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function defaultOperatingHours() {
  return WEEKDAYS.map((day) => ({ day, closed: true, open: '', close: '' }));
}

// A store on the Apexora marketplace. Contact/application fields
// (ownerName, nic, phone, email, address, district, categories,
// documents) are copied in from the SellerApplication at approval time —
// Seller is the canonical, ongoing record from then on; the application
// stays as a historical record of what was submitted.
const sellerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // store name
    legalName: { type: String, required: true, trim: true }, // read-only to sellers — admin-controlled
    brNumber: { type: String, required: true, trim: true }, // read-only to sellers — admin-controlled
    status: { type: String, enum: ['in_review', 'active', 'suspended', 'closed'], default: 'active' },

    district: { type: String, default: '' },
    ownerName: { type: String, default: '' },
    nic: { type: String, default: '' },
    phone: { type: String, default: '' }, // legacy single contact number, set at application time
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    categories: { type: [String], default: [] },
    documents: [{
      type: { type: String }, // 'br_certificate' | 'nic_front' | 'nic_back'
      filename: String,
      path: String,
      mimetype: String,
      size: Number,
      uploadedAt: { type: Date, default: Date.now },
    }],
    verificationNotes: { type: String, default: '' },

    // Optional admin overrides (Seller detail page, owner only).
    commissionOverridePct: { type: Number, default: null },
    probationUntil: { type: Date, default: null },

    application: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerApplication', default: null },

    // --- Milestone 1B: seller-editable storefront profile ---
    displayName: { type: String, default: '', trim: true }, // public-facing name, separate from legalName
    aboutText: {
      en: { type: String, default: '' },
      si: { type: String, default: '' },
      ta: { type: String, default: '' },
    },
    phones: { type: [String], default: [] }, // seller-managed contact numbers, independent of the legacy `phone` field
    whatsapp: { type: String, default: '' },
    operatingHours: { type: [{
      day: { type: String, enum: WEEKDAYS, required: true },
      closed: { type: Boolean, default: true },
      open: { type: String, default: '' }, // "HH:MM"
      close: { type: String, default: '' },
    }], default: defaultOperatingHours },
    returnAddress: { type: String, default: '' },

    logo: {
      path: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
    banner: {
      path: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },

    // Full account number is select:false — never returned by a normal
    // query. Only controllers/adminSellersController.js's dedicated
    // full-view route explicitly re-selects it, and every time it does,
    // that's audited. Every seller-facing and admin-list response only
    // ever sees `last4`.
    bankAccount: {
      bankName: { type: String, default: '' },
      branch: { type: String, default: '' },
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: null, select: false },
      last4: { type: String, default: '' },
      status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
      submittedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null },
      rejectedReason: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

sellerSchema.index({ name: 'text', legalName: 'text', brNumber: 'text', phone: 'text' });

module.exports = mongoose.model('Seller', sellerSchema);
module.exports.WEEKDAYS = WEEKDAYS;
