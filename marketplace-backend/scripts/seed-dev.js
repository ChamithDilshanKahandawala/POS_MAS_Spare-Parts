// Seeds the isolated apexora_dev database with the Milestone 0 cast:
// one platform owner, two sellers, one owner per seller, one seller
// staff on store 1, and one plain customer. Destructive (wipes Users /
// Sellers / SellerMembers first), so on top of loadDevEnv()'s production
// guard it also requires an explicit --yes.
//
// Usage: npm run seed:dev -- --yes
const loadDevEnv = require('./lib/loadDevEnv');
loadDevEnv();

const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');

function guardConfirmation() {
  if (!process.argv.includes('--yes')) {
    console.error('❌ Refusing to run without --yes. This wipes Users/Sellers/SellerMembers in the database above. Re-run as: npm run seed:dev -- --yes');
    process.exit(1);
  }
}

const DEV_PASSWORD = 'DevPass123!';

async function makeUser({ name, email, platformRole = 'none' }) {
  const password = await bcrypt.hash(DEV_PASSWORD, 10);
  return User.create({ name, email, password, platformRole, isActive: true });
}

async function seed() {
  guardConfirmation();
  await connectDB();

  await Promise.all([
    User.deleteMany({ email: { $regex: /@apexora\.test$/ } }),
    SellerMember.deleteMany({}),
    Seller.deleteMany({}),
  ]);
  console.log('🧹 Cleared previous Milestone 0 seed data.');

  const owner = await makeUser({ name: 'Platform Owner', email: 'owner@apexora.test', platformRole: 'platform_owner' });

  const sellerA = await Seller.create({ name: 'Mudiyanse Auto Solutions', legalName: 'Mudiyanse Auto Solutions', brNumber: 'WP/GAM/MI/2025/00255', status: 'active' });
  const sellerB = await Seller.create({ name: 'Partner Store', legalName: 'Partner Store (Pvt) Ltd', brNumber: 'WP/COL/00000/2026', status: 'active' });

  const sellerAOwner = await makeUser({ name: 'Mudiyanse Owner', email: 'seller-a-owner@apexora.test' });
  const sellerAStaff = await makeUser({ name: 'Mudiyanse Staff', email: 'seller-a-staff@apexora.test' });
  const sellerBOwner = await makeUser({ name: 'Partner Store Owner', email: 'seller-b-owner@apexora.test' });
  const customer = await makeUser({ name: 'Dev Customer', email: 'customer@apexora.test' });

  await SellerMember.insertMany([
    { user: sellerAOwner._id, seller: sellerA._id, role: 'seller_owner' },
    { user: sellerAStaff._id, seller: sellerA._id, role: 'seller_staff' },
    { user: sellerBOwner._id, seller: sellerB._id, role: 'seller_owner' },
  ]);

  console.log('\n✅ Milestone 0 seed complete.');
  console.log('-----------------------------------------------------------');
  console.log(`All passwords: ${DEV_PASSWORD}\n`);
  console.log(`Platform owner:        ${owner.email}`);
  console.log(`Seller A owner:        ${sellerAOwner.email}   (store: ${sellerA.name}, id: ${sellerA._id})`);
  console.log(`Seller A staff:        ${sellerAStaff.email}   (store: ${sellerA.name}, id: ${sellerA._id})`);
  console.log(`Seller B owner:        ${sellerBOwner.email}   (store: ${sellerB.name}, id: ${sellerB._id})`);
  console.log(`Customer:               ${customer.email}`);
  console.log('-----------------------------------------------------------');
  console.log('Login is two-step: POST /api/auth/login, then POST /api/auth/verify-otp');
  console.log('with the 6-digit code printed to this console by the dev server.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
