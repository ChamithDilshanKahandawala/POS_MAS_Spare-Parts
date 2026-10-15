// npm test entry point. Validates the test-database guard up front (fail
// fast with a clear message, before spawning anything), runs every
// tests/*.test.js file under Node's built-in test runner, then wipes
// apexora_test clean again afterward so repeated runs start fresh and no
// test data lingers between sessions.
const { spawnSync } = require('child_process');
const path = require('path');

const loadTestEnv = require('./lib/loadTestEnv');
loadTestEnv();

// Deliberately NOT config/db.js's connectDB() here — that guard requires
// apexora_dev specifically (it's built for the main app), which would
// refuse apexora_test. loadTestEnv() above has already done the
// equivalent validation for the test database, so a plain connect is
// correct and safe here.
async function wipeTestDatabase() {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const collections = await mongoose.connection.db.listCollections().toArray();
  await Promise.all(collections.map((c) => mongoose.connection.db.collection(c.name).deleteMany({})));
  await mongoose.disconnect();
}

async function main() {
  console.log('🧪 Running marketplace-backend test suite against apexora_test...\n');

  // No explicit path argument — `node --test` with none relies on its own
  // default discovery glob (**/*.test.js etc.) from cwd, which correctly
  // finds tests/*.test.js. Passing the tests/ directory explicitly here
  // makes it try to *require* that path as a single entry module instead
  // and fails with MODULE_NOT_FOUND — discovered the hard way.
  //
  // --test-timeout: Node's default is 0 (no timeout) — a single hung test
  // (e.g. a stalled MongoDB connection) would otherwise block the whole
  // run forever with no signal anything was wrong, rather than failing
  // loudly. 90s is generous for anything in this suite, which is all
  // local HTTP + a handful of real Atlas round-trips — milestone1b.test.js's
  // before() hook alone (6 users, 3 sellers, 6 full login flows) came
  // within range of the previous 30s budget on an ordinary (not even
  // degraded) connection, timing out its first test and cascading every
  // other test in the file to an instant false failure.
  //
  // --test-concurrency=1: each tests/*.test.js file runs in its own
  // process (Node's default --test-isolation=process) but they all share
  // ONE remote apexora_test database — running them concurrently let
  // auth.test.js's per-test wipeDatabase() delete users
  // authorization.test.js had just created in a different process,
  // failing its logins with a flat-out wrong "Invalid credentials"
  // (discovered the hard way). Forcing one file at a time removes the
  // race entirely; this suite is small enough that losing parallelism
  // doesn't meaningfully slow it down.
  const result = spawnSync('node', ['--test', '--test-timeout=90000', '--test-concurrency=1'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'inherit',
  });

  console.log('\n🧹 Cleaning up apexora_test...');
  await wipeTestDatabase();
  console.log('✅ apexora_test wiped clean.');

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error('❌ Test run failed to complete:', err.message);
  process.exit(1);
});
