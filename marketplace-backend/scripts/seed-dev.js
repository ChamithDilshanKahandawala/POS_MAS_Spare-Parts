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
const SellerApplication = require('../models/SellerApplication');
const Notification = require('../models/Notification');
const { saveFile } = require('../services/storage');
const { createInvite } = require('../services/invites');
const { seedCatalog } = require('./seedCatalog');

// Same minimal-but-real file signatures tests/milestone1a.test.js uses —
// enough for utils/fileType.js's magic-byte check to accept them as real
// documents, so the console's document viewer has something real to
// fetch and display rather than needing fake data.
const SAMPLE_PDF = Buffer.from('%PDF-1.4\nSample BR certificate for dev seed data\n%%EOF');
const SAMPLE_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('sample dev seed NIC photo')]);
const SAMPLE_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('sample dev seed NIC photo'),
]);

function sampleDocuments() {
  return [
    { type: 'br_certificate', filename: 'br-certificate.pdf', path: saveFile(SAMPLE_PDF, 'pdf'), mimetype: 'application/pdf', size: SAMPLE_PDF.length },
    { type: 'nic_front', filename: 'nic-front.jpg', path: saveFile(SAMPLE_JPEG, 'jpg'), mimetype: 'image/jpeg', size: SAMPLE_JPEG.length },
    { type: 'nic_back', filename: 'nic-back.png', path: saveFile(SAMPLE_PNG, 'png'), mimetype: 'image/png', size: SAMPLE_PNG.length },
  ];
}

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
    SellerApplication.deleteMany({}),
    Notification.deleteMany({}),
  ]);
  console.log('🧹 Cleared previous seed data.');

  const owner = await makeUser({ name: 'Platform Owner', email: 'owner@apexora.test', platformRole: 'platform_owner' });
  const staff = await makeUser({ name: 'Platform Staff', email: 'staff@apexora.test', platformRole: 'platform_staff' });

  // Seller A: fully set-up profile (Milestone 1B's Store settings +
  // Home checklist have real data to show) and a bank account pending
  // admin verification.
  const sellerA = await Seller.create({
    name: 'Mudiyanse Auto Solutions',
    slug: 'mudiyanse-auto-solutions',
    legalName: 'Mudiyanse Auto Solutions',
    brNumber: 'WP/GAM/MI/2025/00255',
    status: 'active',
    // Milestone 3: exempt from listing review regardless of probation or
    // category rules — per the milestone's own seed instruction.
    reviewExempt: true,
    displayName: 'Mudiyanse Auto Solutions',
    aboutText: { en: 'Genuine and quality spare parts for all vehicle types, serving Gampaha since 2015.', si: '', ta: '' },
    phones: ['0332222222', '0771234567'],
    whatsapp: '0771234567',
    returnAddress: '123 Negombo Road, Gampaha',
    operatingHours: [
      { day: 'mon', closed: false, open: '08:30', close: '18:00' },
      { day: 'tue', closed: false, open: '08:30', close: '18:00' },
      { day: 'wed', closed: false, open: '08:30', close: '18:00' },
      { day: 'thu', closed: false, open: '08:30', close: '18:00' },
      { day: 'fri', closed: false, open: '08:30', close: '18:00' },
      { day: 'sat', closed: false, open: '08:30', close: '13:00' },
      { day: 'sun', closed: true, open: '', close: '' },
    ],
    bankAccount: {
      bankName: 'Sampath Bank', branch: 'Gampaha', accountName: 'Mudiyanse Auto Solutions',
      accountNumber: '100223344556', last4: '4556', status: 'pending', submittedAt: new Date(),
    },
  });
  // Seller B: a bank account already verified, so the admin panel and
  // seller-facing "verified" badge both have a real example.
  const sellerB = await Seller.create({
    name: 'Partner Store',
    slug: 'partner-store',
    legalName: 'Partner Store (Pvt) Ltd',
    brNumber: 'WP/COL/00000/2026',
    status: 'active',
    bankAccount: {
      bankName: 'HNB', branch: 'Colombo 03', accountName: 'Partner Store Pvt Ltd',
      accountNumber: '200998877665', last4: '7665', status: 'verified', submittedAt: new Date(), verifiedAt: new Date(),
    },
  });
  const sellerC = await Seller.create({ name: 'Suspended Store', slug: 'suspended-store', legalName: 'Suspended Store (Pvt) Ltd', brNumber: 'WP/COL/00001/2026', status: 'suspended' });

  const sellerAOwner = await makeUser({ name: 'Mudiyanse Owner', email: 'seller-a-owner@apexora.test' });
  const sellerAStaff = await makeUser({ name: 'Mudiyanse Staff', email: 'seller-a-staff@apexora.test' });
  const sellerBOwner = await makeUser({ name: 'Partner Store Owner', email: 'seller-b-owner@apexora.test' });
  const sellerCOwner = await makeUser({ name: 'Suspended Store Owner', email: 'seller-c-owner@apexora.test' });
  const customer = await makeUser({ name: 'Dev Customer', email: 'customer@apexora.test' });

  await SellerMember.insertMany([
    { user: sellerAOwner._id, seller: sellerA._id, role: 'seller_owner' },
    { user: sellerAStaff._id, seller: sellerA._id, role: 'seller_staff' },
    { user: sellerBOwner._id, seller: sellerB._id, role: 'seller_owner' },
    { user: sellerCOwner._id, seller: sellerC._id, role: 'seller_owner' },
  ]);

  // Three pending applications — the queue's three statuses before a
  // final decision (new/new/info_requested), each with real sample
  // documents so the console's document viewer has something to show.
  const applications = await SellerApplication.insertMany([
    {
      storeName: 'Colombo Spares Hub',
      legalName: 'Colombo Spares Hub (Pvt) Ltd',
      brNumber: 'WP/COL/00002/2026',
      ownerName: 'Nimal Perera',
      nic: '851234567V',
      phone: '0771111111',
      email: 'nimal@colombospareshub.test',
      address: '45 Galle Road, Colombo 03',
      district: 'Colombo',
      categories: ['Engine Parts', 'Brakes'],
      documents: sampleDocuments(),
      status: 'new',
    },
    {
      storeName: 'Kandy Auto Bazaar',
      legalName: 'Kandy Auto Bazaar',
      brNumber: 'WP/KAN/00003/2026',
      ownerName: 'Sunil Rathnayake',
      nic: '902345678V',
      phone: '0772222222',
      email: 'sunil@kandyautobazaar.test',
      address: '12 Peradeniya Road, Kandy',
      district: 'Kandy',
      categories: ['Tyres', 'Batteries'],
      documents: sampleDocuments(),
      status: 'new',
    },
    {
      storeName: 'Galle Motor Parts',
      legalName: 'Galle Motor Parts (Pvt) Ltd',
      brNumber: 'WP/GAL/00004/2026',
      ownerName: 'Chamari Fernando',
      nic: '883456789V',
      phone: '0773333333',
      email: 'chamari@gallemotorparts.test',
      address: '8 Matara Road, Galle',
      district: 'Galle',
      categories: ['Lubricants'],
      documents: sampleDocuments(),
      status: 'info_requested',
      infoRequestedMessage: 'The BR certificate photo is blurry — please re-upload a clearer copy.',
    },
  ]);

  // A pending seller_staff invite on Store A, so StaffPage's "pending
  // invites" section and the public /invite/:token accept flow both have
  // something real to try.
  const { token: staffInviteToken } = await createInvite({
    email: 'new-staff-invite@apexora.test', role: 'seller_staff', sellerId: sellerA._id, invitedBy: sellerAOwner,
  });

  await Notification.insertMany([
    {
      user: sellerAOwner._id, type: 'application.approved',
      title: 'Welcome to Apexora, Mudiyanse Auto Solutions!',
      body: 'Your seller application was approved and your store is ready to set up.',
      link: '/seller',
    },
    {
      user: sellerAOwner._id, type: 'bank.resubmitted',
      title: 'Bank account pending verification',
      body: 'Your bank account is on file and waiting for Apexora to verify it.',
      link: '/seller/settings',
      read: true,
    },
    {
      user: owner._id, type: 'bank.resubmitted',
      title: 'Mudiyanse Auto Solutions submitted a bank account',
      body: 'Pending verification — review it from the Seller detail page.',
      link: `/admin/sellers/${sellerA._id}`,
    },
  ]);

  const { categoryCount, makeCount } = await seedCatalog();

  console.log('\n✅ Milestone 2 seed complete.');
  console.log('-----------------------------------------------------------');
  console.log(`All passwords: ${DEV_PASSWORD}\n`);
  console.log(`Platform owner:        ${owner.email}`);
  console.log(`Platform staff:        ${staff.email}`);
  console.log(`Seller A owner:        ${sellerAOwner.email}   (store: ${sellerA.name}, active, bank pending, id: ${sellerA._id})`);
  console.log(`Seller A staff:        ${sellerAStaff.email}   (store: ${sellerA.name}, active, id: ${sellerA._id})`);
  console.log(`Seller B owner:        ${sellerBOwner.email}   (store: ${sellerB.name}, active, bank verified, id: ${sellerB._id})`);
  console.log(`Seller C owner:        ${sellerCOwner.email}   (store: ${sellerC.name}, suspended, id: ${sellerC._id})`);
  console.log(`Customer:               ${customer.email}`);
  console.log(`Pending applications:   ${applications.map((a) => a.storeName).join(', ')}`);
  console.log(`Pending staff invite:   new-staff-invite@apexora.test -> /invite/${staffInviteToken} (store: ${sellerA.name})`);
  console.log(`Catalog:                ${categoryCount} categories, ${makeCount} vehicle makes seeded (STARTER lists — see the report for review)`);
  console.log('-----------------------------------------------------------');
  console.log('Login is two-step: POST /api/auth/login, then POST /api/auth/verify-otp');
  console.log('with the 6-digit code printed to this console by the dev server.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
