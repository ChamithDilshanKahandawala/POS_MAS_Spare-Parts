const mongoose = require("mongoose");

// The one database name that's ever held real customer/order data. Kept
// here (not read from env) so a dev/test run can't connect to it just
// because someone's .env.development was missing and it silently fell
// back to the shared .env that has the real MONGO_URI.
const PRODUCTION_DB_NAME = "sparepartspos";

// Reads the database name straight out of the connection string, without
// opening a connection — lets a destructive script (seed-dev.js) check and
// print its target *before* doing anything, not just after connecting.
const getDbNameFromUri = (uri) => {
  const match = (uri || "").match(/\/([^/?]+)(\?|$)/);
  return match ? match[1] : null;
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    const dbName = conn.connection.name;

    if (process.env.NODE_ENV !== "production" && dbName === PRODUCTION_DB_NAME) {
      console.error(
        `❌ Refusing to start: NODE_ENV=${process.env.NODE_ENV || "(unset)"} but MONGO_URI points at ` +
        `the production database ("${dbName}"). Point MONGO_URI at a dev database instead ` +
        `(e.g. "${PRODUCTION_DB_NAME}_dev" on the same cluster) in backend/.env.development.`
      );
      process.exit(1);
    }

    // Database name only — never the host/credentials, even in dev logs.
    console.log(`✅ MongoDB connected — database: "${dbName}" (NODE_ENV=${process.env.NODE_ENV || "unset"})`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.PRODUCTION_DB_NAME = PRODUCTION_DB_NAME;
module.exports.getDbNameFromUri = getDbNameFromUri;
