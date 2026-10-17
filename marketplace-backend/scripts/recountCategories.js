// Rebuilds every Category's `listingCount` (a display-only counter — see
// models/Category.js) from the actual Listing documents, in case it's
// drifted from reality (a direct DB write bypassing the normal
// create/update/delete controllers skips the +1/-1 maintenance entirely —
// exactly what happened to two categories during this session's debug-data
// cleanup). Safe to run any time: it only ever sets listingCount to the
// real count, nothing else on the category.
//   npm run recount:categories
const loadDevEnv = require('./lib/loadDevEnv');
loadDevEnv();

const connectDB = require('../config/db');
const Category = require('../models/Category');
const Listing = require('../models/Listing');

async function run() {
  await connectDB();

  const categories = await Category.find({}, '_id name listingCount').lean();
  console.log(`Recounting ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}...\n`);

  let changed = 0;
  for (const category of categories) {
    const realCount = await Listing.countDocuments({ categoryId: category._id });
    const label = category.name?.en || category._id.toString();
    if (realCount !== category.listingCount) {
      await Category.updateOne({ _id: category._id }, { listingCount: realCount });
      console.log(`  ${label}: ${category.listingCount} -> ${realCount}`);
      changed += 1;
    } else {
      console.log(`  ${label}: ${category.listingCount} (unchanged)`);
    }
  }

  console.log(`\n${changed} categor${changed === 1 ? 'y' : 'ies'} updated, ${categories.length - changed} already correct.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Recount failed:', err.message);
  process.exit(1);
});
