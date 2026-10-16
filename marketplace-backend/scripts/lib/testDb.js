// Manages the local, in-memory MongoDB used by `npm test` — scripts/
// run-tests.js starts this before the suite runs and stops it
// afterward (success, failure, or Ctrl+C), so no test run ever touches
// a real network or Atlas. A single-node REPLICA SET, not a standalone
// mongod: multi-document transactions (needed from the orders/payouts
// milestones onward) only work on a replica set, never on a standalone
// instance, even with one member.
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
const TEST_DB_NAME = 'apexora_test';

// Cached on disk across runs — only the very first run (locally, or on
// a fresh CI cache) ever downloads the MongoDB binary; every run after
// that starts fully offline. MUST be set before `mongodb-memory-server`
// is required — it resolves (and effectively freezes) its download
// config at module-load time, so setting this any later is a no-op and
// it silently falls back to its own default cache path instead.
process.env.MONGOMS_DOWNLOAD_DIR = process.env.MONGOMS_DOWNLOAD_DIR
  || path.join(ROOT, '.cache', 'mongodb-binaries');

const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet = null;

async function startTestDb() {
  replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      // 'ephemeralForTest' (the other option) doesn't support
      // multi-document transactions — wiredTiger does, on any MongoDB
      // version, which is the whole reason this is a replica set.
      storageEngine: 'wiredTiger',
      dbName: TEST_DB_NAME,
    },
  });
  return replSet.getUri(TEST_DB_NAME);
}

async function stopTestDb() {
  if (!replSet) return;
  const current = replSet;
  replSet = null;
  await current.stop();
}

module.exports = { startTestDb, stopTestDb, TEST_DB_NAME };
