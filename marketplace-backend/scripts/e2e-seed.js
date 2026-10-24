// Milestone 5 Part E (extended for Milestone 6 Part H) — seeds real data
// in apexora_dev so the storefront's Playwright run (storefront/
// playwright.config.js, port 5199) has something real to render and, as
// of Milestone 6, a real end-to-end order to place: two sellers (so a
// multi-seller cart is possible), a saved customer address, and
// onlineOrderingEnabled flipped on for the duration of the test run only
// — teardown restores whatever it was before. Run with
// `node scripts/e2e-seed.js`, undo with `node scripts/e2e-teardown.js`
// afterward. Throwaway — never meant to be the final state of apexora_dev.
const loadDevEnv = require('./lib/loadDevEnv');
loadDevEnv();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const Category = require('../models/Category');
const Listing = require('../models/Listing');
const VehicleMake = require('../models/VehicleMake');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const { signAccessToken } = require('../services/tokens');
const { getPlatformSettings } = require('../services/platformSettings');

const SKU_PREFIX = 'E2ETEST-';
const SELLER2_SLUG = 'e2e-test-seller-2';

async function main() {
  await connectDB();

  const seller = await Seller.findOne({ slug: 'mudiyanse-auto-solutions' });
  const category = await Category.findOne({ slug: 'vehicle-parts-three-wheel' }) || await Category.findOne({ active: true });
  let make = await VehicleMake.findOne({ name: 'Bajaj' });
  if (!make) make = await VehicleMake.create({ name: 'Bajaj', type: 'three_wheeler', active: true, models: [{ name: 'RE', yearFrom: 2010, yearTo: 2023, active: true }] });
  const model = make.models.find((m) => m.active) || make.models[0];

  await Listing.deleteMany({ sku: { $regex: `^${SKU_PREFIX}` } }); // idempotent — safe to re-run

  const [listingA, listingB] = await Listing.create([
    {
      seller: seller._id, categoryId: category._id, status: 'published', stock: 12,
      priceCents: 185000, brand: 'Bajaj', condition: 'new', weightGrams: 450,
      title: { en: 'Bajaj RE Brake Shoe Set', si: '', ta: '' },
      description: { en: 'Genuine Bajaj RE brake shoe set, direct fit, long-lasting friction material.', si: '', ta: '' },
      sku: `${SKU_PREFIX}A`, publishedAt: new Date(),
      fitment: [{ makeId: make._id, modelName: model.name, yearFrom: 2012, yearTo: 2020 }],
      warranty: { type: 'months', value: 3 },
    },
    {
      seller: seller._id, categoryId: category._id, status: 'published', stock: 7,
      priceCents: 420000, brand: 'Bosch', condition: 'new', weightGrams: 150,
      title: { en: 'Bosch Spark Plug — Three Wheeler', si: '', ta: '' },
      description: { en: 'Reliable OEM-spec spark plug for three-wheelers.', si: '', ta: '' },
      sku: `${SKU_PREFIX}B`, publishedAt: new Date(),
    },
  ]);

  // --- Milestone 6: a second, independent seller — a multi-seller cart
  // needs two real sellers, and "seller confirms/packs/ships" needs a
  // real owner account to log the API calls in as.
  await Seller.deleteOne({ slug: SELLER2_SLUG });
  await User.deleteOne({ email: 'e2e-seller2-owner@test.apexora' });
  const seller2 = await Seller.create({
    name: 'E2E Test Seller 2', legalName: 'E2E Test Seller 2 Ltd', brNumber: 'BR-E2E2',
    status: 'active', slug: SELLER2_SLUG, displayName: 'E2E Test Seller 2', district: 'Kandy',
  });
  const seller2Owner = await User.create({
    name: 'E2E Seller 2 Owner', email: 'e2e-seller2-owner@test.apexora',
    password: await bcrypt.hash('E2ESeller2Pass123!', 10), isActive: true,
  });
  await SellerMember.create({ user: seller2Owner._id, seller: seller2._id, role: 'seller_owner' });
  const [listingC] = await Listing.create([{
    seller: seller2._id, categoryId: category._id, status: 'published', stock: 10,
    priceCents: 95000, brand: 'Generic', condition: 'new', weightGrams: 300,
    title: { en: 'E2E Seller 2 Test Part', si: '', ta: '' },
    description: { en: 'A second seller listing for multi-seller cart E2E testing.', si: '', ta: '' },
    sku: `${SKU_PREFIX}C`, publishedAt: new Date(),
  }]);

  const email = 'e2e-customer@test.apexora';
  await User.deleteOne({ email });
  const user = await User.create({
    name: 'E2E Customer', email, phone: '0771234567',
    password: await bcrypt.hash('E2ECustomerPass123!', 10), isActive: true,
    addresses: [{ label: 'Home', line1: '12 Test Lane', city: 'Colombo', district: 'Colombo', phone: '0771234567', isDefault: true }],
  });
  const token = signAccessToken(user);
  const addressId = user.addresses[0]._id.toString();

  // Whichever real owner account seller 1 already has — apexora_dev's own
  // seed data owns this, never created fresh here.
  const seller1OwnerMember = await SellerMember.findOne({ seller: seller._id, role: 'seller_owner', status: 'active' }).populate('user');
  const seller1OwnerToken = seller1OwnerMember?.user ? signAccessToken(seller1OwnerMember.user) : null;

  // --- Milestone 6 Part A: flip ordering on for this test run only —
  // save whatever it was so teardown can put it back exactly.
  const settings = await getPlatformSettings();
  const wasOnlineOrderingEnabled = settings.onlineOrderingEnabled;
  settings.onlineOrderingEnabled = true;
  await settings.save();

  const output = {
    customerUserId: user._id.toString(), accessToken: token, addressId,
    makeId: make._id.toString(), makeName: make.name, modelName: model.name,
    seller1Id: seller._id.toString(), seller1OwnerToken,
    seller2Id: seller2._id.toString(), seller2OwnerToken: signAccessToken(seller2Owner),
    listingAId: listingA._id.toString(), listingBId: listingB._id.toString(), listingCId: listingC._id.toString(),
    wasOnlineOrderingEnabled,
  };
  console.log(JSON.stringify(output));
  fs.writeFileSync(path.join(__dirname, '../../storefront/tests-e2e/.seed-output.json'), JSON.stringify(output));
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
