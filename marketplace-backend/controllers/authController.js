const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SellerMember = require('../models/SellerMember');
const { generateOtpCode, hashOtpCode, verifyOtpCode, otpExpiryDate } = require('../services/otpCode');
const {
  signAccessToken,
  issueRefreshToken,
  verifyRefreshTokenSignature,
  refreshTokenMatchesHash,
} = require('../services/tokens');

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
    user: { id: user._id, name: user.name, email: user.email, platformRole: user.platformRole },
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
    user: { id: req.user._id, name: req.user.name, email: req.user.email, platformRole: req.user.platformRole },
    sellerMemberships: memberships.map((m) => ({
      sellerId: m.seller._id,
      sellerName: m.seller.name,
      sellerStatus: m.seller.status,
      role: m.role,
    })),
  });
};

module.exports = { login, verifyOtp, refresh, logout, getMe };
