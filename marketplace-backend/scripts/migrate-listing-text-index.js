// One-off: Milestone 5 replaced Listing's old 4-field text index with a
// single wildcard text index (models/Listing.js). Mongo allows only one
// text index per collection and never auto-drops an index that's been
// removed from the schema, so the old one has to be dropped by name
// before the new one can be created. Safe to run more than once —
// dropIndex on a name that doesn't exist just rejects, which this
// tolerates.
const loadDevEnv = require('./lib/loadDevEnv');
loadDevEnv();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const OLD_INDEX_NAME = 'title.en_text_description.en_text_sku_text_brand_text';

async function main() {
  await connectDB();
  try {
    await mongoose.connection.db.collection('listings').dropIndex(OLD_INDEX_NAME);
    console.log(`✅ Dropped old text index "${OLD_INDEX_NAME}"`);
  } catch (err) {
    console.log(`ℹ️  Nothing to drop ("${OLD_INDEX_NAME}"): ${err.message}`);
  }
  // Recreate from the current schema (the new wildcard text index among them).
  const Listing = require('../models/Listing');
  await Listing.ensureIndexes();
  console.log('✅ Re-synced indexes from the current schema');
  const indexes = await mongoose.connection.db.collection('listings').indexes();
  console.log(indexes.map((i) => i.name));
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
