const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, AuditLog, mongoose,
} = require('./helpers');

// One fixture set for the whole file — these are authorization checks,
// not mutation checks (except the dedicated audit-log test, which cleans
// up after itself), so a shared before() instead of a per-test
// beforeEach keeps the suite fast without weakening what's asserted.
let sellerAOwner, sellerAStaff, sellerBOwner;
let sellerA, sellerB;
let tokens = {};

before(async () => {
  await wipeDatabase();

  // Their emails (hardcoded below in loginFlow calls) are all each test
  // needs — only the seller-member users are referenced again here, to
  // build the SellerMember rows.
  await createUser({ name: 'Owner', email: 'owner@test.apexora', platformRole: 'platform_owner' });
  sellerAOwner = await createUser({ name: 'A Owner', email: 'a-owner@test.apexora' });
  sellerAStaff = await createUser({ name: 'A Staff', email: 'a-staff@test.apexora' });
  sellerBOwner = await createUser({ name: 'B Owner', email: 'b-owner@test.apexora' });
  await createUser({ name: 'Customer', email: 'customer@test.apexora' });

  sellerA = await Seller.create({ name: 'Store A', legalName: 'Store A Ltd', brNumber: 'BR-A' });
  sellerB = await Seller.create({ name: 'Store B', legalName: 'Store B Ltd', brNumber: 'BR-B' });

  await SellerMember.insertMany([
    { user: sellerAOwner._id, seller: sellerA._id, role: 'seller_owner' },
    { user: sellerAStaff._id, seller: sellerA._id, role: 'seller_staff' },
    { user: sellerBOwner._id, seller: sellerB._id, role: 'seller_owner' },
  ]);

  tokens.platformOwner = (await loginFlow('owner@test.apexora')).accessToken;
  tokens.sellerAOwner = (await loginFlow('a-owner@test.apexora')).accessToken;
  tokens.sellerAStaff = (await loginFlow('a-staff@test.apexora')).accessToken;
  tokens.sellerBOwner = (await loginFlow('b-owner@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('customer@test.apexora')).accessToken;
});

// Without this, the open Mongoose connection keeps Node's event loop alive
// indefinitely after the last test finishes — see auth.test.js's identical
// hook for the full explanation.
after(async () => {
  await mongoose.disconnect();
});

test('seller owner of store A gets 404 for store B via X-Seller-Id (not a member there)', async () => {
  const res = await request(app)
    .get('/api/seller/me/store')
    .set('Authorization', `Bearer ${tokens.sellerAOwner}`)
    .set('X-Seller-Id', sellerB._id.toString());
  assert.equal(res.status, 404);
});

test('seller owner of store A succeeds for store A (control)', async () => {
  const res = await request(app)
    .get('/api/seller/me/store')
    .set('Authorization', `Bearer ${tokens.sellerAOwner}`)
    .set('X-Seller-Id', sellerA._id.toString());
  assert.equal(res.status, 200);
  assert.equal(res.body.seller.name, 'Store A');
  assert.equal(res.body.myRole, 'seller_owner');
});

test('seller owner of store A gets 403 on admin routes', async () => {
  const res = await request(app).get('/api/admin/sellers').set('Authorization', `Bearer ${tokens.sellerAOwner}`);
  assert.equal(res.status, 403);
});

test('seller staff gets 403 on the owner-only route', async () => {
  const res = await request(app)
    .get('/api/seller/owner-only-test')
    .set('Authorization', `Bearer ${tokens.sellerAStaff}`)
    .set('X-Seller-Id', sellerA._id.toString());
  assert.equal(res.status, 403);
});

test('seller owner succeeds on the owner-only route (control)', async () => {
  const res = await request(app)
    .get('/api/seller/owner-only-test')
    .set('Authorization', `Bearer ${tokens.sellerAOwner}`)
    .set('X-Seller-Id', sellerA._id.toString());
  assert.equal(res.status, 200);
});

test('seller staff still succeeds on a staff-allowed route (control, not just failure cases)', async () => {
  const res = await request(app)
    .get('/api/seller/me/store')
    .set('Authorization', `Bearer ${tokens.sellerAStaff}`)
    .set('X-Seller-Id', sellerA._id.toString());
  assert.equal(res.status, 200);
  assert.equal(res.body.myRole, 'seller_staff');
});

test('customer gets 404 on a seller route (no membership anywhere)', async () => {
  const res = await request(app)
    .get('/api/seller/me/store')
    .set('Authorization', `Bearer ${tokens.customer}`)
    .set('X-Seller-Id', sellerA._id.toString());
  assert.equal(res.status, 404);
});

test('customer gets 403 on admin routes', async () => {
  const res = await request(app).get('/api/admin/sellers').set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(res.status, 403);
});

test('logged-out (no token) gets 401 on both seller and admin routes', async () => {
  const sellerRes = await request(app).get('/api/seller/me/store').set('X-Seller-Id', sellerA._id.toString());
  assert.equal(sellerRes.status, 401);
  const adminRes = await request(app).get('/api/admin/sellers');
  assert.equal(adminRes.status, 401);
});

test('privileged field (role) in a seller-status-update body is rejected with 400', async () => {
  const res = await request(app)
    .patch(`/api/admin/sellers/${sellerB._id}/status`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ action: 'suspend', reason: 'test', role: 'platform_owner' });
  assert.equal(res.status, 400);
});

test('platform_owner can list sellers (control)', async () => {
  const res = await request(app).get('/api/admin/sellers').set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.sellers.length, 2);
});

test('every admin action writes exactly one audit-log entry', async () => {
  const before = await AuditLog.countDocuments({ targetId: sellerB._id.toString() });

  const res = await request(app)
    .patch(`/api/admin/sellers/${sellerB._id}/status`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ action: 'suspend', reason: 'test suspension' });
  assert.equal(res.status, 200);

  const after = await AuditLog.countDocuments({ targetId: sellerB._id.toString() });
  assert.equal(after, before + 1, 'exactly one new audit-log entry should have been written');

  const entry = await AuditLog.findOne({ targetId: sellerB._id.toString() }).sort({ createdAt: -1 });
  assert.equal(entry.action, 'seller.status.suspend');
  assert.equal(entry.actorRole, 'platform_owner');
  assert.deepEqual(entry.before, { status: 'active' });
  assert.deepEqual(entry.after, { status: 'suspended' });

  // Revert, so this test is re-runnable without depending on prior state.
  await request(app)
    .patch(`/api/admin/sellers/${sellerB._id}/status`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ action: 'reactivate', reason: 'revert test' });
});

test('invalid status transition returns 409 and changes nothing', async () => {
  // sellerA is 'active' by default — 'approve' only accepts 'in_review'.
  const before = await Seller.findById(sellerA._id);
  const res = await request(app)
    .patch(`/api/admin/sellers/${sellerA._id}/status`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ action: 'approve', reason: 'test' });
  assert.equal(res.status, 409);

  const after = await Seller.findById(sellerA._id);
  assert.equal(after.status, before.status);
});

test('there is no route to edit or delete an audit-log entry', async () => {
  const entry = await AuditLog.findOne({});
  const putRes = await request(app)
    .put(`/api/admin/audit-log/${entry?._id || 'x'}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ summary: 'tampered' });
  assert.equal(putRes.status, 404, 'no such route should exist at all');

  const deleteRes = await request(app)
    .delete(`/api/admin/audit-log/${entry?._id || 'x'}`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(deleteRes.status, 404, 'no such route should exist at all');
});
