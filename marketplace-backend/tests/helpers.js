// Shared setup for every test file. Node's test runner defaults to
// --test-isolation=process — each tests/*.test.js file runs as its own
// child process against the same remote apexora_test database, so
// ensureConnected()/mongoose below is only ever establishing ONE
// connection per file, not sharing one across files. Each file is
// responsible for closing it in its own after() hook (see auth.test.js
// and authorization.test.js) — otherwise the open connection keeps that
// file's process alive forever even after every test passes. Exposes the
// real Express app via supertest — no server actually listens on a port
// during tests.
const loadTestEnv = require('../scripts/lib/loadTestEnv');
loadTestEnv();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../server');

const User = require('../models/User');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const AuditLog = require('../models/AuditLog');
const SellerApplication = require('../models/SellerApplication');
const Invite = require('../models/Invite');
const PlatformSettings = require('../models/PlatformSettings');
const Notification = require('../models/Notification');
const Category = require('../models/Category');
const VehicleMake = require('../models/VehicleMake');
const Listing = require('../models/Listing');
const Media = require('../models/Media');
const PosSyncRun = require('../models/PosSyncRun');
const Order = require('../models/Order');
const SellerOrder = require('../models/SellerOrder');
const Counter = require('../models/Counter');
const LedgerEntry = require('../models/LedgerEntry');
const PayoutRun = require('../models/PayoutRun');
const Payout = require('../models/Payout');
const CourierColumnMapping = require('../models/CourierColumnMapping');
const CodRemittanceRow = require('../models/CodRemittanceRow');
const ReturnRequest = require('../models/ReturnRequest');

// Deliberately not config/db.js's connectDB() — that guard requires the
// database to be exactly apexora_dev (it's built for the main app) and
// would refuse apexora_test. loadTestEnv() (required above, before this
// module does anything else) has already validated we're correctly on
// apexora_test, so a plain connect is correct here.
let connected = false;
async function ensureConnected() {
  if (!connected) {
    await mongoose.connect(process.env.MONGO_URI);
    connected = true;
  }
}

async function wipeDatabase() {
  await ensureConnected();
  await Promise.all([
    User.deleteMany({}),
    Seller.deleteMany({}),
    SellerMember.deleteMany({}),
    AuditLog.deleteMany({}),
    SellerApplication.deleteMany({}),
    Invite.deleteMany({}),
    PlatformSettings.deleteMany({}),
    Notification.deleteMany({}),
    Category.deleteMany({}),
    VehicleMake.deleteMany({}),
    Listing.deleteMany({}),
    Media.deleteMany({}),
    PosSyncRun.deleteMany({}),
    Order.deleteMany({}),
    SellerOrder.deleteMany({}),
    Counter.deleteMany({}),
    LedgerEntry.deleteMany({}),
    PayoutRun.deleteMany({}),
    Payout.deleteMany({}),
    CourierColumnMapping.deleteMany({}),
    CodRemittanceRow.deleteMany({}),
    ReturnRequest.deleteMany({}),
  ]);
}

const TEST_PASSWORD = 'TestPass123!';

async function createUser({ name, email, platformRole = 'none' }) {
  const password = await bcrypt.hash(TEST_PASSWORD, 10);
  return User.create({ name, email, password, platformRole, isActive: true });
}

// Exercises the real two-step HTTP flow (login -> verify-otp) exactly as
// a client would. debugOtpCode (NODE_ENV=test only — see
// authController.js) stands in for a human reading the code off the dev
// console. Returns { accessToken, refreshToken, userId }.
async function loginFlow(email, password = TEST_PASSWORD) {
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`loginFlow(${email}) failed at /login: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  const { userId, debugOtpCode } = loginRes.body;
  const otpRes = await request(app).post('/api/auth/verify-otp').send({ userId, code: debugOtpCode });
  if (otpRes.status !== 200) {
    throw new Error(`loginFlow(${email}) failed at /verify-otp: ${otpRes.status} ${JSON.stringify(otpRes.body)}`);
  }

  return { accessToken: otpRes.body.accessToken, refreshToken: otpRes.body.refreshToken, userId };
}

module.exports = {
  app,
  request,
  wipeDatabase,
  ensureConnected,
  createUser,
  loginFlow,
  TEST_PASSWORD,
  User,
  Seller,
  SellerMember,
  AuditLog,
  SellerApplication,
  Invite,
  PlatformSettings,
  Notification,
  Category,
  VehicleMake,
  Listing,
  Media,
  PosSyncRun,
  Order,
  SellerOrder,
  Counter,
  LedgerEntry,
  PayoutRun,
  Payout,
  CourierColumnMapping,
  CodRemittanceRow,
  ReturnRequest,
  mongoose,
};
