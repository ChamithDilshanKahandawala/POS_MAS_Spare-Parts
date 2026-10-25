const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateOtpCode, hashOtpCode, verifyOtpCode, otpExpiryDate } = require('../services/otpCode');

// Milestone 7 — the admin-side counterpart of
// controllers/sellerBankController.js's stepUpStart/stepUpVerify. Same
// two-step password + OTP flow, writing the same User.stepUp* fields
// (they're generic — any User, seller-side or platform-side, can have a
// fresh step-up), gating the SAME middleware/requireFreshStepUp.js.
// Mounted under /api/admin/step-up (routes/adminRoutes.js), owner-only —
// adjustments, payout approval, and the bank export all require it.

// POST /api/admin/step-up
const stepUpStart = async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id);
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Incorrect password' });

  const code = generateOtpCode();
  user.stepUpOtpHash = await hashOtpCode(code);
  user.stepUpOtpExpiresAt = otpExpiryDate();
  await user.save();

  if (process.env.NODE_ENV === 'development') {
    console.log(`\n🔐 Step-up code for ${user.email}: ${code} (expires in 5 min)\n`);
  }

  const response = { message: 'Code sent' };
  if (process.env.NODE_ENV === 'test') response.debugOtpCode = code;
  res.json(response);
};

// POST /api/admin/step-up/verify
const stepUpVerify = async (req, res) => {
  const { code } = req.body;

  if (!req.user.stepUpOtpExpiresAt || req.user.stepUpOtpExpiresAt < new Date()) {
    return res.status(401).json({ message: 'Code expired — please request a new one' });
  }
  const valid = await verifyOtpCode(code, req.user.stepUpOtpHash);
  if (!valid) return res.status(401).json({ message: 'Invalid code' });

  req.user.stepUpOtpHash = null;
  req.user.stepUpOtpExpiresAt = null;
  req.user.stepUpVerifiedAt = new Date();
  await req.user.save();

  res.json({ message: 'Confirmed', stepUpVerifiedAt: req.user.stepUpVerifiedAt });
};

module.exports = { stepUpStart, stepUpVerify };
