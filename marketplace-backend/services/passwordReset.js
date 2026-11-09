const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Same shape as services/invites.js's createInvite: a raw token shown
// exactly once (here, to whoever is about to email/console-log it), with
// only its bcrypt hash ever persisted — a DB read alone never yields a
// usable reset link.
async function createResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  return { token, tokenHash, expiresAt };
}

async function verifyResetToken(token, hash) {
  if (!hash) return false;
  return bcrypt.compare(token, hash);
}

// Stores a fresh reset token on `user` (a full document) and emails the link.
// Throws if the email can't be sent; returns the plain token for tests.
async function sendPasswordResetLink(user) {
  const { sendNow } = require('./messaging');
  const { token, tokenHash, expiresAt } = await createResetToken();
  user.resetPasswordTokenHash = tokenHash;
  user.resetPasswordExpiresAt = expiresAt;
  await user.save();
  const link = `${process.env.STOREFRONT_URL || 'http://localhost:5174'}/reset-password?userId=${user._id}&token=${token}`;
  // Only email — a reset link is never sent by SMS.
  await sendNow({ to: user.email, language: user.preferredLanguage, template: 'password.reset', vars: { link } });
  return token;
}

module.exports = { createResetToken, verifyResetToken, sendPasswordResetLink, RESET_TOKEN_TTL_MS };
