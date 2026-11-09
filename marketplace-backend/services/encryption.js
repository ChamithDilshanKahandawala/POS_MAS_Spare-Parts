// Encrypts a seller's POS integration key at rest (AES-256-GCM) — the
// only place that key is ever stored in plaintext is in-memory for the
// brief moment between receiving it and encrypting it, and in-flight
// over HTTPS when the sync job actually calls the POS with it. Never
// logged, never returned by any API (Seller.posConnection.encryptedKey
// is select:false, same pattern as bankAccount.accountNumber).
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended length for GCM

function keyFrom(secret, name) {
  if (!secret || secret.length !== 64) {
    throw new Error(`${name} must be set to a 32-byte hex string (64 hex characters)`);
  }
  return Buffer.from(secret, 'hex');
}

const getKey = () => keyFrom(process.env.POS_KEY_ENCRYPTION_SECRET, 'POS_KEY_ENCRYPTION_SECRET');

// Returns a single string ("iv:authTag:ciphertext", all hex) so the
// whole thing fits in one schema field.
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

function decryptWith(key, ivHex, authTagHex, ciphertextHex) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8');
}

// Key rotation: values written under POS_KEY_ENCRYPTION_SECRET_PREVIOUS
// still decrypt until scripts/rotate-pos-key.js has re-encrypted them.
function decrypt(encrypted) {
  const [ivHex, authTagHex, ciphertextHex] = String(encrypted).split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error('Malformed encrypted value');
  try {
    return decryptWith(getKey(), ivHex, authTagHex, ciphertextHex);
  } catch (err) {
    const previous = process.env.POS_KEY_ENCRYPTION_SECRET_PREVIOUS;
    if (!previous) throw err;
    return decryptWith(keyFrom(previous, 'POS_KEY_ENCRYPTION_SECRET_PREVIOUS'), ivHex, authTagHex, ciphertextHex);
  }
}

// True when the value was written with the current key (rotation done for it).
function isCurrentKey(encrypted) {
  const [ivHex, authTagHex, ciphertextHex] = String(encrypted).split(':');
  try {
    decryptWith(getKey(), ivHex, authTagHex, ciphertextHex);
    return true;
  } catch {
    return false;
  }
}

module.exports = { encrypt, decrypt, isCurrentKey };
