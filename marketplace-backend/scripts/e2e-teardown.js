const loadDevEnv = require('./lib/loadDevEnv');
loadDevEnv();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Listing = require('../models/Listing');
const User = require('../models/User');

async function main() {
  await connectDB();
  await Listing.deleteMany({ sku: { $regex: '^E2ETEST-' } });
  await User.deleteOne({ email: 'e2e-customer@test.apexora' });
  console.log('✅ Playwright seed data removed');
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
