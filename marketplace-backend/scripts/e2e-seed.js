// Milestone 5 Part E — seeds real data in apexora_dev so the storefront's
// Playwright run (storefront/playwright.config.js, port 5199) has
// something real to render: apexora_dev currently has zero published
// listings. Run with `node scripts/e2e-seed.js`, undo with
// `node scripts/e2e-teardown.js` afterward. Throwaway — deleted once
// Milestone 5's E2E pass is done.
const loadDevEnv = require('./lib/loadDevEnv');
loadDevEnv();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Seller = require('../models/Seller');
const Category = require('../models/Category');
const Listing = require('../models/Listing');
const VehicleMake = require('../models/VehicleMake');
const User = require('../models/User');
const { signAccessToken } = require('../services/tokens');

const SKU_PREFIX = 'E2ETEST-';

async function main() {
  await connectDB();

  const seller = await Seller.findOne({ slug: 'mudiyanse-auto-solutions' });
  const category = await Category.findOne({ slug: 'vehicle-parts-three-wheel' }) || await Category.findOne({ active: true });
  let make = await VehicleMake.findOne({ name: 'Bajaj' });
  if (!make) make = await VehicleMake.create({ name: 'Bajaj', type: 'three_wheeler', active: true, models: [{ name: 'RE', yearFrom: 2010, yearTo: 2023, active: true }] });
  const model = make.models.find((m) => m.active) || make.models[0];

  await Listing.deleteMany({ sku: { $regex: `^${SKU_PREFIX}` } }); // idempotent — safe to re-run

  await Listing.create([
    {
      seller: seller._id, categoryId: category._id, status: 'published', stock: 12,
      priceCents: 185000, brand: 'Bajaj', condition: 'new',
      title: { en: 'Bajaj RE Brake Shoe Set', si: '', ta: '' },
      description: { en: 'Genuine Bajaj RE brake shoe set, direct fit, long-lasting friction material.', si: '', ta: '' },
      sku: `${SKU_PREFIX}A`, publishedAt: new Date(),
      fitment: [{ makeId: make._id, modelName: model.name, yearFrom: 2012, yearTo: 2020 }],
      warranty: { type: 'months', value: 3 },
    },
    {
      seller: seller._id, categoryId: category._id, status: 'published', stock: 7,
      priceCents: 420000, brand: 'Bosch', condition: 'new',
      title: { en: 'Bosch Spark Plug — Three Wheeler', si: '', ta: '' },
      description: { en: 'Reliable OEM-spec spark plug for three-wheelers.', si: '', ta: '' },
      sku: `${SKU_PREFIX}B`, publishedAt: new Date(),
    },
  ]);

  const email = 'e2e-customer@test.apexora';
  await User.deleteOne({ email });
  const user = await User.create({
    name: 'E2E Customer', email, phone: '0771234567',
    password: await bcrypt.hash('E2ECustomerPass123!', 10), isActive: true,
  });
  const token = signAccessToken(user);

  const output = { customerUserId: user._id.toString(), accessToken: token, makeId: make._id.toString(), makeName: make.name, modelName: model.name };
  console.log(JSON.stringify(output));
  fs.writeFileSync(path.join(__dirname, '../../storefront/tests-e2e/.seed-output.json'), JSON.stringify(output));
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
