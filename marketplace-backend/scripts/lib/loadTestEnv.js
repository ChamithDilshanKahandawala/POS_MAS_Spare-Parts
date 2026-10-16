// Entry point for the test runner (scripts/run-tests.js) and every
// tests/*.test.js file (via tests/helpers.js) — validates whatever
// MONGO_URI is already in process.env (scripts/run-tests.js sets it to
// the local in-memory server's URI BEFORE this ever runs; dotenv below
// never overrides an already-set variable, so .env.test's own MONGO_URI
// line is effectively unused now, kept only as a same-shape fallback).
//
// Stricter than loadDevEnv.js in two ways: requires exactly
// apexora_test (refusing apexora_dev too, not just the POS databases),
// AND requires the host to be the local loopback in-memory server —
// never a remote host, and never `mongodb+srv://` (Atlas' own scheme).
// A test run must be able to work fully offline and must never be able
// to reach or affect a real database, accidentally or otherwise.
const path = require('path');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '../../');
const TEST_DB_NAME = 'apexora_test';
const LOCAL_MONGO_URI_RE = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/;

function loadTestEnv() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run: NODE_ENV=production. Tests never run against production.');
    process.exit(1);
  }

  dotenv.config({ path: path.join(ROOT, '.env.test') });
  dotenv.config({ path: path.join(ROOT, '.env') });

  const { FORBIDDEN_DB_NAMES, DEV_DB_NAME, getDbNameFromUri } = require(path.join(ROOT, 'config/db'));
  const uri = process.env.MONGO_URI || '';
  const dbName = getDbNameFromUri(uri);
  console.log(`[loadTestEnv] target database: "${dbName || '(could not parse MONGO_URI)'}"`);

  if (FORBIDDEN_DB_NAMES.includes(dbName)) {
    console.error(`❌ Refusing to run tests: "${dbName}" belongs to the POS system. Aborting.`);
    process.exit(1);
  }
  if (dbName === DEV_DB_NAME) {
    console.error(`❌ Refusing to run tests against "${DEV_DB_NAME}" — tests only run against the local in-memory "${TEST_DB_NAME}".`);
    process.exit(1);
  }
  if (dbName !== TEST_DB_NAME) {
    console.error(`❌ Refusing to run: MONGO_URI resolves to database "${dbName}", not "${TEST_DB_NAME}".`);
    process.exit(1);
  }
  if (uri.startsWith('mongodb+srv://') || !LOCAL_MONGO_URI_RE.test(uri)) {
    console.error(
      '❌ Refusing to run: tests must connect to the local in-memory MongoDB server only ' +
      '(started by scripts/run-tests.js / scripts/lib/testDb.js), never a remote or Atlas host. ' +
      `Got: "${uri.replace(/\/\/[^@]*@/, '//<redacted>@')}"`
    );
    process.exit(1);
  }

  return { dbName };
}

module.exports = loadTestEnv;
module.exports.TEST_DB_NAME = TEST_DB_NAME;
