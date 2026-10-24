const loadDevEnv = require('./lib/loadDevEnv');
loadDevEnv();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const Order = require('../models/Order');
const SellerOrder = require('../models/SellerOrder');
const { getPlatformSettings } = require('../services/platformSettings');

const SELLER2_SLUG = 'e2e-test-seller-2';
const SEED_OUTPUT_PATH = path.join(__dirname, '../../storefront/tests-e2e/.seed-output.json');

async function main() {
  await connectDB();

  // Milestone 6: undo e2e-seed.js's temporary onlineOrderingEnabled: true —
  // restores whatever the real dev setting was before the test run, read
  // back from the seed-output file it wrote.
  if (fs.existsSync(SEED_OUTPUT_PATH)) {
    const seedOutput = JSON.parse(fs.readFileSync(SEED_OUTPUT_PATH, 'utf8'));
    if ('wasOnlineOrderingEnabled' in seedOutput) {
      const settings = await getPlatformSettings();
      settings.onlineOrderingEnabled = seedOutput.wasOnlineOrderingEnabled;
      await settings.save();
    }
  }

  // Orders/seller-orders created by the real checkout flow during the
  // test run — scoped to the throwaway e2e customer, never a real one.
  const customer = await User.findOne({ email: 'e2e-customer@test.apexora' }).select('_id').lean();
  if (customer) {
    await SellerOrder.deleteMany({ customer: customer._id });
    await Order.deleteMany({ customer: customer._id });
  }

  await Listing.deleteMany({ sku: { $regex: '^E2ETEST-' } });
  await User.deleteOne({ email: 'e2e-customer@test.apexora' });

  const seller2 = await Seller.findOne({ slug: SELLER2_SLUG }).select('_id').lean();
  if (seller2) {
    await SellerMember.deleteMany({ seller: seller2._id });
    await Seller.deleteOne({ _id: seller2._id });
  }
  await User.deleteOne({ email: 'e2e-seller2-owner@test.apexora' });

  console.log('✅ Playwright seed data removed');
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
