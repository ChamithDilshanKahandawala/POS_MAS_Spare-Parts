// Deletes Media documents (and their files) that were uploaded but never
// attached to a listing, and are now more than 24h old — a seller who
// uploaded photos mid-wizard and then abandoned the draft before saving
// the Photos step leaves these behind. Dev-only, run manually:
//   node scripts/cleanupMedia.js --yes
const loadDevEnv = require('./lib/loadDevEnv');
loadDevEnv();

const connectDB = require('../config/db');
const Media = require('../models/Media');
const { deleteFile } = require('../services/storage');

const UNUSED_AFTER_MS = 24 * 60 * 60 * 1000;

function guardConfirmation() {
  if (!process.argv.includes('--yes')) {
    console.error('❌ Refusing to run without --yes. This permanently deletes unattached media files. Re-run as: node scripts/cleanupMedia.js --yes');
    process.exit(1);
  }
}

async function run() {
  guardConfirmation();
  await connectDB();

  const cutoff = new Date(Date.now() - UNUSED_AFTER_MS);
  const stale = await Media.find({ listing: null, createdAt: { $lt: cutoff } });

  if (stale.length === 0) {
    console.log('✅ No unattached media older than 24h — nothing to clean up.');
    process.exit(0);
  }

  for (const media of stale) {
    for (const size of ['thumb', 'medium', 'large']) {
      deleteFile(media.variants[size].webp);
      deleteFile(media.variants[size].jpg);
    }
  }
  await Media.deleteMany({ _id: { $in: stale.map((m) => m._id) } });

  console.log(`🧹 Deleted ${stale.length} unattached media item(s) older than 24h.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Cleanup failed:', err.message);
  process.exit(1);
});
