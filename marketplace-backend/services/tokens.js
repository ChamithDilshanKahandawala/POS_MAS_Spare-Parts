const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signAccessToken(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

// The refresh token is its own signed JWT (separate secret from the
// access token, so a leaked access token alone can't be used to mint
// new ones) — signing it lets the user id be read back out directly on
// refresh, with no separate lookup table needed. A hash of it is also
// stored on the user (see issueRefreshToken's caller), so a stolen-but-
// still-signature-valid token can still be invalidated by logout/rotation
// — signature validity alone isn't sufficient, the hash must match too.
function signRefreshToken(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

function verifyRefreshTokenSignature(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

async function issueRefreshToken(user) {
  const token = signRefreshToken(user);
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { token, tokenHash, expiresAt };
}

async function refreshTokenMatchesHash(token, tokenHash) {
  if (!tokenHash) return false;
  return bcrypt.compare(token, tokenHash);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  verifyRefreshTokenSignature,
  refreshTokenMatchesHash,
};
