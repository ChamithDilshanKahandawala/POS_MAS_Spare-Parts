const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SellerMember = require('../models/SellerMember');
const { generateOtpCode, hashOtpCode, verifyOtpCode, otpExpiryDate } = require('../services/otpCode');
const { createResetToken, verifyResetToken } = require('../services/passwordReset');
const {
  signAccessToken,
  issueRefreshToken,
  verifyRefreshTokenSignature,
  refreshTokenMatchesHash,
} = require('../services/tokens');

// POST /api/auth/register — Milestone 5: customer self-registration.
// Creates a plain User (platformRole: 'none', no SellerMember) and
// immediately issues a login OTP, exactly like `login` below does after
// a password check — register has already established "this is a new,
// real account", so the client goes straight to /verify-otp with the
// returned userId, the same second step a normal login uses.
const register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, phone, password: passwordHash, isActive: true });

  const code = generateOtpCode();
  user.otpCodeHash = await hashOtpCode(code);
  user.otpExpiresAt = otpExpiryDate();
  await user.save();

  if (process.env.NODE_ENV === 'development') {
    console.log(`\n🔐 OTP for ${user.email}: ${code} (expires in 5 min)\n`);
  }

  const response = { message: 'Account created — OTP sent', userId: user._id };
  if (process.env.NODE_ENV === 'test') response.debugOtpCode = code;
  res.status(201).json(response);
};

// POST /api/auth/forgot-password — always a generic 200, whether or not
// the email exists, so this can never be used to probe which emails have
// an account (same anti-enumeration reasoning as login's shared "Invalid
// credentials" message). Dev/prod both have no email provider wired up
// yet (Milestone 0's situation, unchanged) — the reset link goes to the
// console instead, same as the OTP code.
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    const { token, tokenHash, expiresAt } = await createResetToken();
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expiresAt;
    await user.save();

    if (process.env.NODE_ENV === 'development') {
      console.log(`\n🔑 Password reset link for ${user.email}: /reset-password?userId=${user._id}&token=${token} (expires in 30 min)\n`);
    }

    const response = { message: 'If that email has an account, a reset link has been sent.' };
    if (process.env.NODE_ENV === 'test') response.debugResetToken = token;
    return res.json(response);
  }

  res.json({ message: 'If that email has an account, a reset link has been sent.' });
};

// POST /api/auth/reset-password — also invalidates any existing session
// (refresh token cleared) so a password reset can't be undermined by a
// still-valid refresh token minted before the compromise/reset.
const resetPassword = async (req, res) => {
  const { userId, token, newPassword } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(400).json({ message: 'Invalid or expired reset link' });

  if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid or expired reset link' });
  }
  const valid = await verifyResetToken(token, user.resetPasswordTokenHash);
  if (!valid) return res.status(400).json({ message: 'Invalid or expired reset link' });

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpiresAt = null;
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();

  res.json({ message: 'Password reset — please log in again' });
};

// Step 1 of 2: password check, then issue an OTP (never a session token
// yet). Same generic "Invalid credentials" for both a wrong email and a
// wrong password, so the response never confirms whether an email exists.
const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });

  const code = generateOtpCode();
  user.otpCodeHash = await hashOtpCode(code);
  user.otpExpiresAt = otpExpiryDate();
  await user.save();

  // Dev only: there's no email/SMS provider wired up yet (Milestone 0
  // scope), so the code goes to the console instead. Never logged outside
  // NODE_ENV=development.
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n🔐 OTP for ${user.email}: ${code} (expires in 5 min)\n`);
  }

  const response = { message: 'OTP sent', userId: user._id };
  // Test only: the code is bcrypt-hashed at rest, so an automated test
  // has no way to recover it after the fact the way a human reads it off
  // the dev console. Returning it in-band here (NODE_ENV=test only, never
  // development or production) is the test-equivalent of that console
  // message, not a weakened flow — production always requires a real
  // delivery channel it doesn't have access to from the response.
  if (process.env.NODE_ENV === 'test') {
    response.debugOtpCode = code;
  }
  res.json(response);
};

// Step 2 of 2: verify the OTP, then issue the real session (access +
// refresh tokens).
const verifyOtp = async (req, res) => {
  const { userId, code } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ message: 'Invalid code' });

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    return res.status(401).json({ message: 'Code expired — please log in again' });
  }

  const valid = await verifyOtpCode(code, user.otpCodeHash);
  if (!valid) return res.status(401).json({ message: 'Invalid code' });

  // One-time: clear it immediately so the same code can't be replayed.
  user.otpCodeHash = null;
  user.otpExpiresAt = null;

  const accessToken = signAccessToken(user);
  const { token: refreshToken, tokenHash, expiresAt } = await issueRefreshToken(user);
  user.refreshTokenHash = tokenHash;
  user.refreshTokenExpiresAt = expiresAt;
  await user.save();

  res.json({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, platformRole: user.platformRole, phone: user.phone, preferredLanguage: user.preferredLanguage },
  });
};

// Issues a new access token from a still-valid refresh token. Does NOT
// rotate the refresh token itself for Milestone 0's scope — rotation can
// be added later without changing this route's shape.
const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  let decoded;
  try {
    decoded = verifyRefreshTokenSignature(refreshToken);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }

  const user = await User.findById(decoded.id).lean();
  if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid or expired refresh token' });
  if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }

  const matches = await refreshTokenMatchesHash(refreshToken, user.refreshTokenHash);
  if (!matches) return res.status(401).json({ message: 'Invalid or expired refresh token' });

  const accessToken = signAccessToken(user);
  res.json({ accessToken });
};

// requireAuth already ran — req.user is the authenticated user. Clears
// their stored refresh token so it can never be used again, regardless
// of whether the access token used to call this route is still valid
// for a few more minutes.
const logout = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: null, refreshTokenExpiresAt: null });
  res.json({ message: 'Logged out' });
};

// GET /api/auth/me — requireAuth only, no platform/seller gate. Exists so
// a client (console/) can discover what it's allowed to show WITHOUT
// guessing: the user's own platform role, plus every seller they're a
// member of and in what role — exactly the memberships
// requireSellerMember itself checks against, never anything the client
// could assert on its own. This is what drives the Admin/My-store
// switcher's options.
const getMe = async (req, res) => {
  const memberships = await SellerMember.find({ user: req.user._id, status: 'active' }).populate('seller', 'name status').lean();
  res.json({
    user: {
      id: req.user._id, name: req.user.name, email: req.user.email, platformRole: req.user.platformRole,
      phone: req.user.phone, preferredLanguage: req.user.preferredLanguage,
    },
    sellerMemberships: memberships.map((m) => ({
      sellerId: m.seller._id,
      sellerName: m.seller.name,
      sellerStatus: m.seller.status,
      role: m.role,
    })),
  });
};

module.exports = { register, forgotPassword, resetPassword, login, verifyOtp, refresh, logout, getMe };
