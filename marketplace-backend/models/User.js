const mongoose = require('mongoose');
const { SRI_LANKA_DISTRICTS } = require('../utils/sriLankaDistricts');

// A user's seller-level roles live in SellerMember, not here — a single
// user can be seller_owner of one store and seller_staff of another.
// platformRole is the only role stored directly on User, since it's
// global (not scoped to any one seller). A user with platformRole:'none'
// and no SellerMember records is just a customer — there's no separate
// stored "customer" role, it's the absence of platform/seller privilege.
// Milestone 5: customer-only fields (phone, preferredLanguage, addresses,
// vehicles) live on this same model rather than a separate Customer
// collection — login/OTP/refresh/logout (controllers/authController.js)
// already work for ANY User regardless of platformRole, so a customer is
// just another User and gets that whole flow for free.
const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, default: '' },
  line1: { type: String, trim: true, required: true },
  line2: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, required: true },
  district: { type: String, enum: SRI_LANKA_DISTRICTS, required: true },
  landmark: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, required: true },
  isDefault: { type: Boolean, default: false },
});

const savedVehicleSchema = new mongoose.Schema({
  makeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleMake', required: true },
  modelName: { type: String, trim: true, required: true },
  year: { type: Number, default: null },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, trim: true, default: '' },
    preferredLanguage: { type: String, enum: ['en', 'si', 'ta'], default: 'en' },
    platformRole: { type: String, enum: ['none', 'platform_staff', 'platform_owner'], default: 'none' },
    isActive: { type: Boolean, default: true },

    // Max 10, enforced in controllers/customerController.js — the schema
    // itself doesn't cap array length.
    addresses: { type: [addressSchema], default: [] },
    vehicles: { type: [savedVehicleSchema], default: [] },

    // Forgot/reset password (Milestone 5). Hashed like the password
    // itself — a DB read alone never yields a usable token. Separate
    // from otpCodeHash/stepUpOtpHash so a pending reset can never be
    // confused with a pending login OTP or step-up.
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },

    // Two-step login (OTP). Hashed like the password — a DB read alone
    // never yields a usable code. Cleared after a successful verify or
    // once expired.
    otpCodeHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },

    // Single active refresh token per user (good enough for this
    // foundation; multi-session support can move this to its own
    // collection later without changing the auth flow's shape). Hashed
    // for the same reason the password is.
    refreshTokenHash: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },

    // "Step-up" re-authentication (Milestone 1B's bank account flow) —
    // a SEPARATE OTP from the login one above, so stepping up in one tab
    // can never invalidate a pending login in another. stepUpVerifiedAt
    // is the actual gate routes check (controllers/sellerBankController.js);
    // it's set once the OTP is verified and only counts for 5 minutes.
    stepUpOtpHash: { type: String, default: null },
    stepUpOtpExpiresAt: { type: Date, default: null },
    stepUpVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
