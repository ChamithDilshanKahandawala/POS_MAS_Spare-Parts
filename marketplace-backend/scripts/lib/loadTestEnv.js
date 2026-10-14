// Entry point for the test runner (scripts/run-tests.js) only. Stricter
// than loadDevEnv.js: requires exactly apexora_test, refusing
// apexora_dev too (not just the POS databases) — so an automated test
// run can never touch real dev-session data, only its own disposable
// database.
const path = require('path');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '../../');
const TEST_DB_NAME = 'apexora_test';

function loadTestEnv() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run: NODE_ENV=production. Tests never run against production.');
    process.exit(1);
  }

  dotenv.config({ path: path.join(ROOT, '.env.test') });
  dotenv.config({ path: path.join(ROOT, '.env') });

  const { FORBIDDEN_DB_NAMES, DEV_DB_NAME, getDbNameFromUri } = require(path.join(ROOT, 'config/db'));
  const dbName = getDbNameFromUri(process.env.MONGO_URI);
  console.log(`[loadTestEnv] target database: "${dbName || '(could not parse MONGO_URI)'}"`);

  if (FORBIDDEN_DB_NAMES.includes(dbName)) {
    console.error(`❌ Refusing to run tests: "${dbName}" belongs to the POS system. Aborting.`);
    process.exit(1);
  }
  if (dbName === DEV_DB_NAME) {
    console.error(`❌ Refusing to run tests against "${DEV_DB_NAME}" — tests only run against "${TEST_DB_NAME}". Check marketplace-backend/.env.test.`);
    process.exit(1);
  }
  if (dbName !== TEST_DB_NAME) {
    console.error(`❌ Refusing to run: MONGO_URI resolves to "${dbName}", not "${TEST_DB_NAME}". Check marketplace-backend/.env.test.`);
    process.exit(1);
  }

  return { dbName };
}

module.exports = loadTestEnv;
module.exports.TEST_DB_NAME = TEST_DB_NAME;
