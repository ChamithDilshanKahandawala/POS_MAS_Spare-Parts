// A last line of defense for services/auditLog.js — every current
// controller already hand-picks which fields go into a before/after
// snapshot (never a raw full document for Seller/User/SellerApplication),
// but that discipline lives in each call site, not enforced anywhere. If
// a future change ever does pass a raw document through — a `.toObject()`
// that includes bankAccount.accountNumber, a password hash, an OTP hash,
// a token, or a NIC number — this is what stops it from landing in the
// audit log at all, rather than relying on every future call site to
// remember.
//
// Matched by KEY NAME (case-insensitive), not by guessing at value
// shape — deliberately broad (matches "accountNumber", "tokenHash",
// "stepUpOtpHash", etc.) since missing a sensitive field here is worse
// than over-masking an innocuous one.
const SENSITIVE_KEY_PATTERN = /password|otp|token|accountnumber|^nic$/i;

// Account/NIC numbers keep a last-4 for "is this the account I think it
// is" without exposing the rest. Hashes, tokens and OTP codes have no
// legitimate partial-reveal use — full redact.
const PARTIAL_REVEAL_PATTERN = /accountnumber|^nic$/i;

function maskValue(key, value) {
  if (value === null || value === undefined) return value;
  if (PARTIAL_REVEAL_PATTERN.test(key) && typeof value === 'string') {
    return value.length > 4 ? `***${value.slice(-4)}` : '***';
  }
  return '[REDACTED]';
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && !(value instanceof Date) && typeof value.toHexString !== 'function'; // ObjectId has toHexString
}

// Recursively walks a before/after snapshot, masking any key whose name
// matches SENSITIVE_KEY_PATTERN at any depth. Leaves Dates, ObjectIds,
// and non-matching fields untouched.
function maskAuditSnapshot(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(maskAuditSnapshot);
  if (!isPlainObject(obj)) return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = maskValue(key, value);
    } else if (isPlainObject(value) || Array.isArray(value)) {
      result[key] = maskAuditSnapshot(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

module.exports = { maskAuditSnapshot, SENSITIVE_KEY_PATTERN };
