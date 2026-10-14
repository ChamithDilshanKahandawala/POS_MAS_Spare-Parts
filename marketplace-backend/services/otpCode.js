const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Six digits, no leading-zero bias — crypto.randomInt is uniform over its
// range, unlike Math.random()-based digit generation.
function generateOtpCode() {
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

async function hashOtpCode(code) {
  return bcrypt.hash(code, 10);
}

async function verifyOtpCode(code, hash) {
  if (!hash) return false;
  return bcrypt.compare(code, hash);
}

function otpExpiryDate() {
  return new Date(Date.now() + OTP_TTL_MS);
}

module.exports = { generateOtpCode, hashOtpCode, verifyOtpCode, otpExpiryDate, OTP_TTL_MS };
