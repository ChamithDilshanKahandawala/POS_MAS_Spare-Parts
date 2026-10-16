// npm test entry point. Starts a local, in-memory MongoDB replica set
// (scripts/lib/testDb.js — never touches the network or Atlas), runs
// every tests/*.test.js file against it under Node's built-in test
// runner, then always tears the in-memory server down again: on normal
// completion, on a failing suite, and on Ctrl+C.
const { spawn } = require('child_process');
const path = require('path');

const { startTestDb, stopTestDb } = require('./lib/testDb');

let testChild = null;
let cleanupStarted = false;

async function cleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  console.log('\n🧹 Stopping the in-memory MongoDB server...');
  await stopTestDb();
}

// Ctrl+C (or an external kill) must still tear down the in-memory
// mongod process — forward the signal to the still-running `node --test`
// child first so its own in-progress test can exit, then clean up.
async function handleSignal(signal, exitCode) {
  if (testChild && !testChild.killed) testChild.kill(signal);
  await cleanup();
  process.exit(exitCode);
}
process.on('SIGINT', () => handleSignal('SIGINT', 130));
process.on('SIGTERM', () => handleSignal('SIGTERM', 143));

function runTests() {
  return new Promise((resolve) => {
    // --test-timeout: a normal budget — nothing here ever touches a
    // real network anymore, so there's no reason for the old 90s
    // allowance (that existed purely for Atlas latency).
    //
    // --test-concurrency=1: each tests/*.test.js file runs in its own
    // process (Node's default --test-isolation=process) but they all
    // share ONE database on the in-memory server — running them
    // concurrently would let one file's wipeDatabase() delete data
    // another file just created (discovered the hard way, back when
    // this ran against a shared remote database). One file at a time
    // removes the race entirely.
    testChild = spawn('node', ['--test', '--test-timeout=30000', '--test-concurrency=1'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit',
    });
    testChild.on('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

async function main() {
  console.log('🧪 Starting a local in-memory MongoDB for tests (the first run downloads the MongoDB binary once; every run after that is fully offline)...');
  const uri = await startTestDb();
  process.env.MONGO_URI = uri;

  // Validates the URI we just set (and loads JWT secrets etc. from
  // .env.test) — must run AFTER MONGO_URI is set, since dotenv never
  // overrides an already-set environment variable.
  const loadTestEnv = require('./lib/loadTestEnv');
  loadTestEnv();

  console.log('🧪 Running marketplace-backend test suite against the in-memory database...\n');
  return runTests();
}

main()
  .then((code) => cleanup().then(() => process.exit(code)))
  .catch((err) => {
    console.error('❌ Test run failed to complete:', err.message);
    cleanup().then(() => process.exit(1));
  });
