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

module.exports = { createResetToken, verifyResetToken, RESET_TOKEN_TTL_MS };
