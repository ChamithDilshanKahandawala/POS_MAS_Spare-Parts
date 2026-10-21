const bcrypt = require('bcryptjs');
const Seller = require('../models/Seller');
const User = require('../models/User');
const { generateOtpCode, hashOtpCode, verifyOtpCode, otpExpiryDate } = require('../services/otpCode');
const { logAction } = require('../services/auditLog');
const { notify } = require('../services/notifications');
const { stripFullAccountNumber } = require('../utils/sanitizeSeller');

// POST /api/seller/bank/step-up — step 1: password check, then an OTP
// (separate from the login OTP — see models/User.js's stepUp* fields).
// requireAuth's own query excludes `password` from req.user (same as
// every other route), so the hash is re-fetched here specifically.
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

// POST /api/seller/bank/step-up/verify — step 2: verifying this sets
// stepUpVerifiedAt, which middleware/requireFreshStepUp.js checks is
// within the last 5 minutes before allowing PATCH /bank.
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

// GET /api/seller/bank — owner or staff. accountNumber is select:false
// on the schema, so it's never populated here in the first place — but
// an explicit .select('bankAccount') (an inclusive field list) was found
// to silently override that nested exclusion (MongoDB projections don't
// know about Mongoose's per-path select:false once you hand it your own
// explicit projection), so this deliberately does a plain findById with
// no select() at all, and strips the field again regardless, the same
// defensive way updateBank() below does — never trust one layer alone
// for something this sensitive.
const getBank = async (req, res) => {
  const seller = await Seller.findById(req.sellerId).lean();
  if (!seller) return res.status(404).json({ message: 'Seller not found' });
  res.json({ bankAccount: stripFullAccountNumber(seller).bankAccount });
};

// PATCH /api/seller/bank — owner only, requires a fresh step-up
// (middleware/requireFreshStepUp.js) and an active store
// (middleware/requireActiveStore.js, applied at the route). Always lands
// in 'pending' — a brand new account and a change to a previously
// verified one are handled the same way, except the latter also notifies
// platform staff (the account they already verified no longer matches
// what's on file).
const updateBank = async (req, res) => {
  const { bankName, branch, accountName, accountNumber, reason } = req.body;
  const seller = await Seller.findById(req.sellerId);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const wasVerified = seller.bankAccount.status === 'verified';

  seller.bankAccount = {
    bankName,
    branch,
    accountName,
    accountNumber,
    last4: accountNumber.slice(-4),
    status: 'pending',
    submittedAt: new Date(),
    verifiedAt: null,
    rejectedReason: '',
  };
  await seller.save();

  await logAction({
    actor: req.user,
    actorRole: req.sellerMember.role,
    action: 'seller.bank.update',
    targetType: 'Seller',
    targetId: seller._id,
    after: { bankName, branch, accountName, last4: seller.bankAccount.last4 },
    summary: `${req.user.name} ${wasVerified ? 'changed the verified' : 'submitted a'} bank account for verification. ${reason ? `Reason: ${reason}` : ''}`.trim(),
  });

  if (wasVerified) {
    const platformOwners = await User.find({ platformRole: 'platform_owner' }).lean();
    await Promise.all(platformOwners.map((owner) => notify({
      userId: owner._id,
      type: 'bank.resubmitted',
      title: `${seller.name} changed their bank account`,
      body: 'Their previously verified account was replaced and is now pending re-verification.',
      link: `/admin/sellers/${seller._id}`,
    })));
  }

  res.json({ bankAccount: stripFullAccountNumber(seller).bankAccount });
};

module.exports = { stepUpStart, stepUpVerify, getBank, updateBank };
