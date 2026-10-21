// Milestone 4 Part C — POS integration, POS mocked. global.fetch is
// replaced with an in-memory fake POS for this whole file (each
// tests/*.test.js file is its own process — see helpers.js — so this
// never leaks into any other test file). Every call is recorded in
// fetchCalls so the "sync never writes to the POS" assertion has
// something real to check.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, AuditLog, User, Category, Notification, Listing, PosSyncRun, mongoose,
} = require('./helpers');
const { encrypt } = require('../services/encryption');

const POS_KEY = 'dev-test-integration-key-00001';

let posProducts = [];
let posShouldFail = false;
const fetchCalls = [];

global.fetch = async (url, opts = {}) => {
  const method = opts.method || 'GET';
  fetchCalls.push({ url: url.toString(), method });

  if (posShouldFail) throw new Error('ECONNREFUSED (simulated POS outage)');

  const headers = opts.headers || {};
  if (headers['X-Integration-Key'] !== POS_KEY) {
    return { ok: false, status: 401, text: async () => 'Unauthorized' };
  }

  const u = new URL(url.toString());
  const updatedSince = u.searchParams.get('updatedSince');
  let products = posProducts;
  if (updatedSince) {
    const since = new Date(updatedSince);
    products = products.filter((p) => new Date(p.updatedAt) > since);
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ products, page: 1, pages: 1, total: products.length }),
  };
};

function posProductFixture(overrides = {}) {
  return {
    id: 'POS1',
    sku_code: 'SKU1',
    name: 'Brake Pad Set',
    brand: 'Bosch',
    category: 'Engine Parts',
    sub_category: 'Brakes',
    selling_price: 150000,
    stock_quantity: 20,
    unit: 'pcs',
    updatedAt: new Date().toISOString(),
    active: true,
    ...overrides,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function seller(req, id) {
  return req.set('X-Seller-Id', id.toString());
}

let platformOwnerUser;
let sellerA; // posConnection.enabled = true
let sellerB; // posConnection.enabled = false (control group)
let category;
let tokens = {};

before(async () => {
  await wipeDatabase();

  platformOwnerUser = await createUser({ name: 'Platform Owner', email: 'owner@test.apexora', platformRole: 'platform_owner' });
  const aOwnerUser = await createUser({ name: 'A Owner', email: 'a-owner@test.apexora' });
  const aStaffUser = await createUser({ name: 'A Staff', email: 'a-staff@test.apexora' });
  const bOwnerUser = await createUser({ name: 'B Owner', email: 'b-owner@test.apexora' });

  category = await Category.create({ name: { en: 'Engine Parts' }, slug: 'engine-parts', depth: 0, active: true });

  sellerA = await Seller.create({
    name: 'Mudiyanse Auto Solutions',
    legalName: 'Mudiyanse Auto Solutions Pvt Ltd',
    brNumber: 'BR-A',
    status: 'active',
    posConnection: {
      enabled: true,
      baseUrl: 'http://fake-pos.test',
      encryptedKey: encrypt(POS_KEY),
      keyLast4: POS_KEY.slice(-4),
    },
  });
  sellerB = await Seller.create({ name: 'Store B', legalName: 'Store B Ltd', brNumber: 'BR-B', status: 'active' });

  await SellerMember.create({ user: aOwnerUser._id, seller: sellerA._id, role: 'seller_owner' });
  await SellerMember.create({ user: aStaffUser._id, seller: sellerA._id, role: 'seller_staff' });
  await SellerMember.create({ user: bOwnerUser._id, seller: sellerB._id, role: 'seller_owner' });

  tokens.platformOwner = (await loginFlow('owner@test.apexora')).accessToken;
  tokens.aOwner = (await loginFlow('a-owner@test.apexora')).accessToken;
  tokens.aStaff = (await loginFlow('a-staff@test.apexora')).accessToken;
  tokens.bOwner = (await loginFlow('b-owner@test.apexora')).accessToken;
});

beforeEach(() => {
  posProducts = [posProductFixture()];
  posShouldFail = false;
});

after(async () => {
  await mongoose.disconnect();
});

// --- Admin: enabling a connection ---

test('admin can enable a seller POS connection; key is encrypted, masked in the audit log, never returned', async () => {
  const res = await request(app)
    .patch(`/api/admin/sellers/${sellerB._id}/pos`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ enabled: true, baseUrl: 'http://fake-pos-b.test', integrationKey: 'another-secret-key-99999', reason: 'Milestone 4 rollout' });

  assert.equal(res.status, 200);
  assert.equal(res.body.posConnection.enabled, true);
  assert.equal(res.body.posConnection.keyLast4, 'another-secret-key-99999'.slice(-4));
  assert.equal(JSON.stringify(res.body).includes('another-secret-key-99999'), false);

  const stored = await Seller.findById(sellerB._id).select('+posConnection.encryptedKey').lean();
  assert.notEqual(stored.posConnection.encryptedKey, 'another-secret-key-99999');

  const entry = await AuditLog.findOne({ action: 'seller.pos.update', targetId: sellerB._id.toString() }).lean();
  assert.ok(entry);
  const entryText = JSON.stringify(entry);
  assert.equal(entryText.includes('another-secret-key-99999'), false);

  // Revert — sellerB stays the "control group" (connection disabled) for every other test below.
  await Seller.updateOne({ _id: sellerB._id }, { $set: { 'posConnection.enabled': false } });
});

// --- Access control ---

test('only the seller with an enabled POS connection can list/import/sync; others get 404', async () => {
  const resProducts = await seller(request(app).get('/api/seller/pos/products').set('Authorization', `Bearer ${tokens.bOwner}`), sellerB._id);
  assert.equal(resProducts.status, 404);

  const resImport = await seller(request(app).post('/api/seller/pos/import').set('Authorization', `Bearer ${tokens.bOwner}`), sellerB._id)
    .send({ posProductIds: ['POS1'] });
  assert.equal(resImport.status, 404);

  const resSync = await seller(request(app).post('/api/seller/pos/sync').set('Authorization', `Bearer ${tokens.bOwner}`), sellerB._id).send({});
  assert.equal(resSync.status, 404);

  const okProducts = await seller(request(app).get('/api/seller/pos/products').set('Authorization', `Bearer ${tokens.aOwner}`), sellerA._id);
  assert.equal(okProducts.status, 200);
  assert.equal(okProducts.body.products.length, 1);
});

test('POS connection status is visible even when disabled, reporting "off"', async () => {
  const res = await seller(request(app).get('/api/seller/pos/status').set('Authorization', `Bearer ${tokens.bOwner}`), sellerB._id);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'off');
  assert.equal(res.body.enabled, false);
});

test('seller staff can import but never sees or changes the key; the key never appears in any response or audit entry', async () => {
  const res = await seller(request(app).post('/api/seller/pos/import').set('Authorization', `Bearer ${tokens.aStaff}`), sellerA._id)
    .send({ posProductIds: ['POS1'] });

  assert.equal(res.status, 200);
  assert.equal(res.body.created.length, 1);
  assert.equal(JSON.stringify(res.body).includes(POS_KEY), false);

  const statusRes = await seller(request(app).get('/api/seller/pos/status').set('Authorization', `Bearer ${tokens.aStaff}`), sellerA._id);
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.body.keyLast4, POS_KEY.slice(-4));
  assert.equal('encryptedKey' in statusRes.body, false);

  const entry = await AuditLog.findOne({ action: 'seller.pos.import', targetId: sellerA._id.toString() }).sort({ createdAt: -1 }).lean();
  assert.ok(entry);
  assert.equal(JSON.stringify(entry).includes(POS_KEY), false);

  await Listing.deleteMany({ seller: sellerA._id }); // cleanup for the next test's fresh import
});

// --- Import ---

test('import creates a prefilled draft listing; importing the same POS product again is rejected, not duplicated', async () => {
  const res1 = await seller(request(app).post('/api/seller/pos/import').set('Authorization', `Bearer ${tokens.aOwner}`), sellerA._id)
    .send({ posProductIds: ['POS1'] });
  assert.equal(res1.status, 200);
  assert.equal(res1.body.created.length, 1);
  assert.equal(res1.body.skipped.length, 0);

  const listing = await Listing.findOne({ seller: sellerA._id, posProductId: 'POS1' }).lean();
  assert.ok(listing);
  assert.equal(listing.status, 'draft');
  assert.equal(listing.title.en, 'Brake Pad Set');
  assert.equal(listing.brand, 'Bosch');
  assert.equal(listing.sku, 'SKU1');
  assert.equal(listing.priceCents, 150000);
  assert.equal(listing.stock, 20);
  assert.equal(listing.categoryId.toString(), category._id.toString());

  const res2 = await seller(request(app).post('/api/seller/pos/import').set('Authorization', `Bearer ${tokens.aOwner}`), sellerA._id)
    .send({ posProductIds: ['POS1'] });
  assert.equal(res2.status, 200);
  assert.equal(res2.body.created.length, 0);
  assert.equal(res2.body.skipped.length, 1);
  assert.equal(res2.body.skipped[0].reason, 'already imported');

  const count = await Listing.countDocuments({ seller: sellerA._id, posProductId: 'POS1' });
  assert.equal(count, 1);
});

// --- Sync ---

test('sync updates only price and stock on linked listings; title/photos/status untouched; priceHistory records "POS sync"', async () => {
  const before2 = await Listing.findOne({ seller: sellerA._id, posProductId: 'POS1' }).lean();
  const originalTitle = before2.title.en;
  const originalStatus = before2.status;
  const originalImages = before2.images;

  await sleep(10);
  posProducts = [posProductFixture({ selling_price: 175000, stock_quantity: 5, updatedAt: new Date().toISOString() })];

  const res = await seller(request(app).post('/api/seller/pos/sync').set('Authorization', `Bearer ${tokens.aOwner}`), sellerA._id).send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.run.status, 'success');
  assert.equal(res.body.run.listingsUpdated, 1);

  const after2 = await Listing.findOne({ seller: sellerA._id, posProductId: 'POS1' }).lean();
  assert.equal(after2.priceCents, 175000);
  assert.equal(after2.stock, 5);
  assert.equal(after2.title.en, originalTitle);
  assert.equal(after2.status, originalStatus);
  assert.deepEqual(after2.images, originalImages);

  const lastHistoryEntry = after2.priceHistory[after2.priceHistory.length - 1];
  assert.equal(lastHistoryEntry.priceCents, 175000);
  assert.equal(lastHistoryEntry.by, 'POS sync');

  const sellerDoc = await Seller.findById(sellerA._id).lean();
  assert.ok(sellerDoc.posConnection.lastSuccessfulSyncAt);
  assert.equal(sellerDoc.posConnection.consecutiveFailures, 0);
});

test('a POS product that goes inactive zeroes the linked listing\'s stock and notifies the seller (the listing is not deleted)', async () => {
  await Notification.deleteMany({});
  await sleep(10);
  posProducts = [posProductFixture({ active: false, updatedAt: new Date().toISOString() })];

  const res = await seller(request(app).post('/api/seller/pos/sync').set('Authorization', `Bearer ${tokens.aOwner}`), sellerA._id).send({});
  assert.equal(res.status, 200);

  const listing = await Listing.findOne({ seller: sellerA._id, posProductId: 'POS1' }).lean();
  assert.ok(listing); // still exists — never deleted
  assert.equal(listing.stock, 0);

  const ownerMembership = await SellerMember.findOne({ seller: sellerA._id, role: 'seller_owner' }).lean();
  const notification = await Notification.findOne({ user: ownerMembership.user, type: 'pos.product_removed' }).lean();
  assert.ok(notification);
});

test('3 consecutive sync failures notify the seller owner and platform owners; lastSuccessfulSyncAt is unchanged on failure', async () => {
  const before3 = await Seller.findById(sellerA._id).lean();
  const lastGoodSync = before3.posConnection.lastSuccessfulSyncAt;

  await Notification.deleteMany({});
  posShouldFail = true;

  for (let i = 0; i < 3; i += 1) {
    const res = await seller(request(app).post('/api/seller/pos/sync').set('Authorization', `Bearer ${tokens.aOwner}`), sellerA._id).send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.run.status, 'failed');
  }

  const after3 = await Seller.findById(sellerA._id).lean();
  assert.equal(after3.posConnection.consecutiveFailures, 3);
  assert.equal(after3.posConnection.failureNotified, true);
  assert.deepEqual(after3.posConnection.lastSuccessfulSyncAt, lastGoodSync);

  const ownerMembership = await SellerMember.findOne({ seller: sellerA._id, role: 'seller_owner' }).lean();
  const ownerNotification = await Notification.findOne({ user: ownerMembership.user, type: 'pos.sync_failing' }).lean();
  assert.ok(ownerNotification);
  const platformNotification = await Notification.findOne({ user: platformOwnerUser._id, type: 'pos.sync_failing' }).lean();
  assert.ok(platformNotification);

  const runs = await PosSyncRun.find({ seller: sellerA._id }).sort({ startedAt: -1 }).limit(3).lean();
  assert.equal(runs.every((r) => r.status === 'failed'), true);

  posShouldFail = false;
});

test('the sync job never sends anything but GET requests to the POS', () => {
  assert.ok(fetchCalls.length > 0);
  assert.equal(fetchCalls.every((c) => c.method === 'GET'), true);
});
