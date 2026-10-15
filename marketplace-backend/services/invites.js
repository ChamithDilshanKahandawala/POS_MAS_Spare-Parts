const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Invite = require('../models/Invite');

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48h

// Creates a pending invite and returns the raw token (only ever shown
// once, here — the DB only ever stores its hash). Dev has no real email
// provider wired up (same situation as the OTP flow), so the resulting
// link is logged to the console instead; a real email gets wired in
// later without this function's shape needing to change.
async function createInvite({ email, role, sellerId = null, invitedBy }) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await Invite.create({
    email: email.toLowerCase(),
    role,
    seller: sellerId,
    invitedBy: invitedBy._id,
    tokenHash,
    expiresAt,
  });

  return { invite, token };
}

// Finds the still-pending, unexpired invite whose token matches —
// O(pending invites) rather than a direct lookup, same tradeoff as any
// hashed-token design (can't index on a value you don't store).
async function findInviteByToken(token) {
  const candidates = await Invite.find({ status: 'pending', expiresAt: { $gt: new Date() } });
  for (const invite of candidates) {
    if (await bcrypt.compare(token, invite.tokenHash)) return invite;
  }
  return null;
}

module.exports = { createInvite, findInviteByToken, INVITE_TTL_MS };
