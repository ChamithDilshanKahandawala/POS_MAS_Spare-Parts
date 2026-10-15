const mongoose = require('mongoose');

// A user's seller-level roles live in SellerMember, not here — a single
// user can be seller_owner of one store and seller_staff of another.
// platformRole is the only role stored directly on User, since it's
// global (not scoped to any one seller). A user with platformRole:'none'
// and no SellerMember records is just a customer — there's no separate
// stored "customer" role, it's the absence of platform/seller privilege.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    platformRole: { type: String, enum: ['none', 'platform_staff', 'platform_owner'], default: 'none' },
    isActive: { type: Boolean, default: true },

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
