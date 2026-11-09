// Re-encrypts every stored POS integration key with the current
// POS_KEY_ENCRYPTION_SECRET. Run after setting the new secret and moving the
// old one to POS_KEY_ENCRYPTION_SECRET_PREVIOUS; remove _PREVIOUS once this
// reports 0 remaining. Safe to re-run. See docs in README "Key rotation".
//
//   NODE_ENV=production node scripts/rotate-pos-key.js   (on the server)
//   node scripts/rotate-pos-key.js                         (dev database)
const path = require('path');
const dotenv = require('dotenv');

const NODE_ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `../.env.${NODE_ENV}`) });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const { encrypt, decrypt, isCurrentKey } = require('../services/encryption');

async function rotatePosKeys() {
  const sellers = await Seller.find({ 'posConnection.encryptedKey': { $nin: [null, ''] } }).select('+posConnection.encryptedKey name');
  let rotated = 0;
  let failed = 0;
  for (const seller of sellers) {
    const stored = seller.posConnection.encryptedKey;
    if (isCurrentKey(stored)) continue;
    try {
      seller.posConnection.encryptedKey = encrypt(decrypt(stored));
      await seller.save();
      rotated += 1;
    } catch (err) {
      failed += 1;
      console.error(`Could not re-encrypt the POS key for ${seller.name}: ${err.message}`);
    }
  }
  return { checked: sellers.length, rotated, failed };
}

if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await rotatePosKeys();
    console.log(`POS keys: ${result.checked} checked, ${result.rotated} re-encrypted, ${result.failed} failed.`);
    await mongoose.disconnect();
    process.exit(result.failed ? 1 : 0);
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { rotatePosKeys };
