// Shared entry point for every standalone dev script in marketplace-
// backend/ (seed-dev.js) that connects to MongoDB directly, outside the
// Express app. Same pattern as backend/scripts/lib/loadDevEnv.js: load
// .env.development the way server.js does, then refuse to continue if
// NODE_ENV is "production" or the resolved database isn't exactly the
// one dev database this script is allowed to touch.
//
// Deliberately stricter than just blocklisting production: this requires
// a POSITIVE match on apexora_dev, so a stray MONGO_URI pointed at
// apexora_test (or anything else) is refused too, not just the obviously
// dangerous names.
const path = require('path');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '../../');

function loadDevEnv() {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '❌ Refusing to run: NODE_ENV=production. Standalone scripts in marketplace-backend/ ' +
      'never run against production, regardless of what MONGO_URI would resolve to.'
    );
    process.exit(1);
  }

  const NODE_ENV = process.env.NODE_ENV || 'development';
  dotenv.config({ path: path.join(ROOT, `.env.${NODE_ENV}`) });
  dotenv.config({ path: path.join(ROOT, '.env') });

  const { DEV_DB_NAME, FORBIDDEN_DB_NAMES, getDbNameFromUri } = require(path.join(ROOT, 'config/db'));
  const dbName = getDbNameFromUri(process.env.MONGO_URI);
  console.log(`[loadDevEnv] NODE_ENV=${NODE_ENV} — target database: "${dbName || '(could not parse MONGO_URI)'}"`);

  if (FORBIDDEN_DB_NAMES.includes(dbName)) {
    console.error(`❌ Refusing to run: "${dbName}" belongs to the POS system. Aborting.`);
    process.exit(1);
  }
  if (dbName !== DEV_DB_NAME) {
    console.error(
      `❌ Refusing to run: MONGO_URI resolves to "${dbName}", not the expected dev database ("${DEV_DB_NAME}"). ` +
      `Point MONGO_URI at "${DEV_DB_NAME}" in marketplace-backend/.env.development instead.`
    );
    process.exit(1);
  }

  return { dbName, NODE_ENV };
}

module.exports = loadDevEnv;
