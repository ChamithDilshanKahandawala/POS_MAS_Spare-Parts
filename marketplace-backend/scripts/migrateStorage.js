// Moves files referenced by absolute local paths (written before storage keys
// existed) into the active storage driver and rewrites each record to the
// key. Set STORAGE_DRIVER=s3 + S3_* first to move them into the bucket.
// Local files are left in place; delete uploads/ yourself once the app has
// run on the bucket for a while. Safe to re-run.
//
//   node scripts/migrateStorage.js --dry-run
//   NODE_ENV=production STORAGE_DRIVER=s3 node scripts/migrateStorage.js
const path = require('path');
const dotenv = require('dotenv');

const NODE_ENV = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `../.env.${NODE_ENV}`) });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const SellerApplication = require('../models/SellerApplication');
const Seller = require('../models/Seller');
const Media = require('../models/Media');
const ReturnRequest = require('../models/ReturnRequest');
const ContentBlock = require('../models/ContentBlock');
const { isLegacyPath, activeDriver, localDriver, KEY_RE } = require('../services/storage');

// Where each model keeps file paths, as dotted paths inside one document
// ("[]" marks an array of sub-documents).
const SOURCES = [
  { model: SellerApplication, fields: ['documents[].path'] },
  { model: Seller, fields: ['logo.path', 'banner.path'] },
  { model: Media, fields: ['thumb', 'medium', 'large'].flatMap((s) => [`variants.${s}.webp`, `variants.${s}.jpg`]) },
  { model: ReturnRequest, fields: ['photos[].path'] },
  { model: ContentBlock, fields: ['draft.imagePath', 'published.imagePath'] },
];

function keyFor(legacyPath) {
  const key = `${path.basename(path.dirname(legacyPath))}/${path.basename(legacyPath)}`;
  if (!KEY_RE.test(key)) throw new Error(`Unexpected file name for migration: ${legacyPath}`);
  return key;
}

// Returns [{ setPath, value }] for every legacy path inside one document.
function legacyRefs(doc, field) {
  const [head, tail] = field.split('[].');
  if (tail) {
    return (doc[head] || []).flatMap((item, i) => (isLegacyPath(item?.[tail] || '') ? [{ setPath: `${head}.${i}.${tail}`, value: item[tail] }] : []));
  }
  const value = field.split('.').reduce((o, k) => o?.[k], doc);
  return value && isLegacyPath(value) ? [{ setPath: field, value }] : [];
}

async function migrateStorage({ dryRun = false, log = console.log } = {}) {
  const driver = activeDriver();
  const totals = { moved: 0, missing: 0, failed: 0 };
  for (const { model, fields } of SOURCES) {
    const docs = await model.find({}).select([...new Set(fields.map((f) => f.split('[]')[0].split('.')[0]))].join(' ')).lean();
    for (const doc of docs) {
      const $set = {};
      for (const ref of fields.flatMap((f) => legacyRefs(doc, f))) {
        try {
          const buffer = await localDriver.get(ref.value);
          const key = keyFor(ref.value);
          if (!dryRun) await driver.put(key, buffer);
          $set[ref.setPath] = key;
          totals.moved += 1;
        } catch (err) {
          if (err.code === 'ENOENT') { totals.missing += 1; log(`missing on disk: ${model.modelName} ${doc._id} ${ref.setPath}`); } else { totals.failed += 1; log(`failed: ${model.modelName} ${doc._id} ${ref.setPath}: ${err.message}`); }
        }
      }
      if (!dryRun && Object.keys($set).length) await model.collection.updateOne({ _id: doc._id }, { $set });
    }
  }
  log(`${dryRun ? '[dry run] ' : ''}storage migration to "${driver.name}": ${totals.moved} moved, ${totals.missing} missing on disk, ${totals.failed} failed.`);
  return totals;
}

if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const totals = await migrateStorage({ dryRun: process.argv.includes('--dry-run') });
    await mongoose.disconnect();
    process.exit(totals.failed ? 1 : 0);
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { migrateStorage };
