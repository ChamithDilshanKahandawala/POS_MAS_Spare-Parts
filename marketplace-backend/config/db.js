const mongoose = require("mongoose");

// Database names that must never be reachable from marketplace-backend,
// no matter what MONGO_URI says or what NODE_ENV claims — these belong to
// the separate POS system (backend/ + frontend/), which this project must
// never affect. Checked unconditionally, before the NODE_ENV-based rule
// below even runs.
const FORBIDDEN_DB_NAMES = ["sparepartspos", "storefront_dev"];

// The one dev database name this app is allowed to run against outside
// NODE_ENV=production. Kept here (not read from env) for the same reason
// backend/config/db.js keeps PRODUCTION_DB_NAME here — a dev run can't
// silently end up somewhere else just because .env.development was
// missing and something fell back to an unexpected MONGO_URI.
const DEV_DB_NAME = "apexora_dev";

// Reads the database name straight out of the connection string, without
// opening a connection — lets a destructive script check and print its
// target *before* doing anything, not just after connecting.
const getDbNameFromUri = (uri) => {
  const match = (uri || "").match(/\/([^/?]+)(\?|$)/);
  return match ? match[1] : null;
};

const connectDB = async () => {
  try {
    const dbNameFromUri = getDbNameFromUri(process.env.MONGO_URI);

    // Unconditional: these two names are never valid for this app, in any
    // NODE_ENV, even "production" (this app's own production database has
    // its own separate name, decided later — it is never one of these).
    if (FORBIDDEN_DB_NAMES.includes(dbNameFromUri)) {
      console.error(
        `❌ Refusing to start: MONGO_URI points at "${dbNameFromUri}", which belongs to the POS system. ` +
        `marketplace-backend must never connect to it.`
      );
      process.exit(1);
    }

    // Outside NODE_ENV=production, only the one designated dev database is
    // allowed — catches a stray/typo'd MONGO_URI (e.g. pointed at
    // apexora_test, or a real future production URI) before it's used for
    // a dev run.
    if (process.env.NODE_ENV !== "production" && dbNameFromUri !== DEV_DB_NAME) {
      console.error(
        `❌ Refusing to start: NODE_ENV=${process.env.NODE_ENV || "(unset)"} but MONGO_URI resolves to ` +
        `"${dbNameFromUri || "(could not parse MONGO_URI)"}", not the expected dev database ("${DEV_DB_NAME}"). ` +
        `Point MONGO_URI at "${DEV_DB_NAME}" in marketplace-backend/.env.development instead.`
      );
      process.exit(1);
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);
    const dbName = conn.connection.name;

    // Database name only — never the host/credentials, even in dev logs.
    console.log(`✅ MongoDB connected — database: "${dbName}" (NODE_ENV=${process.env.NODE_ENV || "unset"})`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.FORBIDDEN_DB_NAMES = FORBIDDEN_DB_NAMES;
module.exports.DEV_DB_NAME = DEV_DB_NAME;
module.exports.getDbNameFromUri = getDbNameFromUri;
