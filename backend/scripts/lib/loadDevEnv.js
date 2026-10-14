// Shared entry point for every standalone script in backend/ (seed
// scripts, test-*.js) that connects to MongoDB directly, outside the
// Express app. Call this before requiring any model/controller that
// touches process.env.MONGO_URI.
//
// Does two things, in order:
//   1. Loads .env.development the same way server.js does (NODE_ENV-
//      specific file first, since dotenv never overrides an already-set
//      var, then the plain .env as a fallback for anything that file
//      didn't define).
//   2. Refuses to continue (exit 1) if NODE_ENV is "production" or the
//      resolved MONGO_URI points at the production database — so a
//      standalone script can never reach production, even if someone
//      puts a production URI back into .env/.env.development by mistake.
//
// This exists because server.js's own connectDB() guard (config/db.js)
// only runs *after* opening a connection, and only protects the Express
// app's own startup path — it never ran for ad-hoc scripts invoked with
// a plain `node some-script.js`, which is exactly how two test writes
// reached production before this helper existed.
const path = require('path');
const dotenv = require('dotenv');

const BACKEND_ROOT = path.resolve(__dirname, '../../');

function loadDevEnv() {
  // Checked before any .env file is even read, so an explicit
  // NODE_ENV=production can't cause a production-named file to load at all.
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '❌ Refusing to run: NODE_ENV=production. Standalone scripts in backend/ ' +
      'never run against production, regardless of what MONGO_URI would resolve to.'
    );
    process.exit(1);
  }

  const NODE_ENV = process.env.NODE_ENV || 'development';
  dotenv.config({ path: path.join(BACKEND_ROOT, `.env.${NODE_ENV}`) });
  dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

  const { PRODUCTION_DB_NAME, getDbNameFromUri } = require(path.join(BACKEND_ROOT, 'config/db'));
  const dbName = getDbNameFromUri(process.env.MONGO_URI);
  console.log(`[loadDevEnv] NODE_ENV=${NODE_ENV} — target database: "${dbName || '(could not parse MONGO_URI)'}"`);

  if (dbName === PRODUCTION_DB_NAME) {
    console.error(
      `❌ Refusing to run: MONGO_URI resolves to the production database ("${dbName}"). ` +
      `Point MONGO_URI at a dev database (e.g. "${PRODUCTION_DB_NAME}_dev") in backend/.env.development instead.`
    );
    process.exit(1);
  }

  return { dbName, NODE_ENV };
}

module.exports = loadDevEnv;
