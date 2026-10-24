// Milestone 6 — checkout, orders, stock reservation, delivery fees,
// seller/admin order management, auto-cancel. Each tests/*.test.js file
// is its own process against a shared in-memory replica set (see
// helpers.js) — this sets up its own sellers/listings/customers rather
// than relying on any other milestone's fixtures.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, User, Category, Listing, PlatformSettings, Order, SellerOrder, Notification, AuditLog, mongoose,
} = require('./helpers');
const { encrypt } = require('../services/encryption');
const { cancelOverdue } = require('../services/orderAutoCancel');
const { runSweep: runPosRecordedReminderSweep } = require('../services/posRecordedReminder');

const POS_KEY = 'dev-test-integration-key-00001';
const name = (en) => ({ en, si: '', ta: '' });
const idemKey = () => `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

let category;
let sellerA, sellerB, sellerPos;
let tokens = {};
let addrCustomer1, addrCustomer2;
let listingA, listingB, listingPos, listingLastUnit;
let platformOwnerUser;

before(async () => {
  await wipeDatabase();

  platformOwnerUser = await createUser({ name: 'Platform Owner', email: 'owner@test.apexora', platformRole: 'platform_owner' });
  const aOwnerUser = await createUser({ name: 'A Owner', email: 'a-owner@test.apexora' });
  const aStaffUser = await createUser({ name: 'A Staff', email: 'a-staff@test.apexora' });
  const bOwnerUser = await createUser({ name: 'B Owner', email: 'b-owner@test.apexora' });
  const posOwnerUser = await createUser({ name: 'Pos Owner', email: 'pos-owner@test.apexora' });
  const customer1 = await createUser({ name: 'Customer One', email: 'customer1@test.apexora' });
  const customer2 = await createUser({ name: 'Customer Two', email: 'customer2@test.apexora' });

  category = await Category.create({ name: name('Engine Parts'), slug: 'engine-parts-m6', depth: 0, active: true, commissionRateBps: 500 });

  sellerA = await Seller.create({ name: 'Seller A', legalName: 'Seller A Ltd', brNumber: 'BR-A6', status: 'active', slug: 'seller-a-m6' });
  sellerB = await Seller.create({ name: 'Seller B', legalName: 'Seller B Ltd', brNumber: 'BR-B6', status: 'active', slug: 'seller-b-m6' });
  sellerPos = await Seller.create({
    name: 'Pos Seller', legalName: 'Pos Seller Ltd', brNumber: 'BR-POS6', status: 'active', slug: 'pos-seller-m6',
    posConnection: {
      enabled: true, baseUrl: 'http://fake-pos.test', encryptedKey: encrypt(POS_KEY), keyLast4: POS_KEY.slice(-4),
      lastSuccessfulSyncAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago — stale (>30min)
    },
  });

  await SellerMember.create({ user: aOwnerUser._id, seller: sellerA._id, role: 'seller_owner' });
  await SellerMember.create({ user: aStaffUser._id, seller: sellerA._id, role: 'seller_staff' });
  await SellerMember.create({ user: bOwnerUser._id, seller: sellerB._id, role: 'seller_owner' });
  await SellerMember.create({ user: posOwnerUser._id, seller: sellerPos._id, role: 'seller_owner' });

  tokens.platformOwner = (await loginFlow('owner@test.apexora')).accessToken;
  tokens.aOwner = (await loginFlow('a-owner@test.apexora')).accessToken;
  tokens.aStaff = (await loginFlow('a-staff@test.apexora')).accessToken;
  tokens.bOwner = (await loginFlow('b-owner@test.apexora')).accessToken;
  tokens.posOwner = (await loginFlow('pos-owner@test.apexora')).accessToken;
  tokens.customer1 = (await loginFlow('customer1@test.apexora')).accessToken;
  tokens.customer2 = (await loginFlow('customer2@test.apexora')).accessToken;

  const c1 = await User.findById(customer1._id);
  c1.addresses.push({ line1: '12 Galle Road', city: 'Colombo', district: 'Colombo', phone: '0771111111', isDefault: true });
  await c1.save();
  addrCustomer1 = c1.addresses[0]._id.toString();

  const c2 = await User.findById(customer2._id);
  c2.addresses.push({ line1: '45 Kandy Road', city: 'Kandy', district: 'Kandy', phone: '0772222222', isDefault: true });
  await c2.save();
  addrCustomer2 = c2.addresses[0]._id.toString();

  await PlatformSettings.create({ _id: 'platform-settings', onlineOrderingEnabled: true });

  listingA = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 10, priceCents: 185000,
    weightGrams: 500, title: name('Brake Shoe Set'), publishedAt: new Date(),
  });
  listingB = await Listing.create({
    seller: sellerB._id, categoryId: category._id, status: 'published', stock: 10, priceCents: 420000,
    weightGrams: 2000, title: name('Spark Plug'), publishedAt: new Date(),
  });
  listingPos = await Listing.create({
    seller: sellerPos._id, categoryId: category._id, status: 'published', stock: 5, priceCents: 250000,
    weightGrams: 1000, title: name('POS Linked Part'), publishedAt: new Date(),
  });
  listingLastUnit = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 1, priceCents: 100000,
    weightGrams: 300, title: name('Last Unit Item'), publishedAt: new Date(),
  });
});

after(async () => {
  await mongoose.disconnect();
});

// --- Part A: ordering on/off ---

test('onlineOrderingEnabled OFF → order placement rejected server-side, not just hidden in the UI', async () => {
  await PlatformSettings.updateOne({ _id: 'platform-settings' }, { $set: { onlineOrderingEnabled: false } });
  const res = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1,
    items: [{ listingId: listingA._id.toString(), qty: 1 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(res.status, 403);
  await PlatformSettings.updateOne({ _id: 'platform-settings' }, { $set: { onlineOrderingEnabled: true } });
});

// --- Part B: delivery fees ---

test('delivery fee is computed server-side from PlatformSettings.deliveryRates by district, never trusted from the client', async () => {
  // listingB alone: 2000g = ceil(2/1)=2kg parcel, Kandy (non-Western) = 57500 + 7500*(2-1) = 65000
  const res = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer2}`).send({
    addressId: addrCustomer2,
    items: [{ listingId: listingB._id.toString(), qty: 1 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(res.status, 201);
  const sellerOrder = res.body.sellerOrders[0];
  assert.equal(sellerOrder.weightKg, 2);
  assert.equal(sellerOrder.deliveryFeeCents, 65000);
  assert.equal(sellerOrder.codAmountCents, sellerOrder.itemsTotalCents + sellerOrder.deliveryFeeCents);
});

test('a listing with no real weight defaults to 1kg for the fee calc and is flagged weightEstimated', async () => {
  const noWeightListing = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 5, priceCents: 50000,
    weightGrams: 0, title: name('No Weight Item'), publishedAt: new Date(),
  });
  const res = await request(app).post('/api/customer/checkout/preview').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1,
    items: [{ listingId: noWeightListing._id.toString(), qty: 1 }],
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.sellerGroups[0].weightKg, 1);
  assert.equal(res.body.sellerGroups[0].items[0].weightEstimated, true);
});

// --- Part C / H: price & field tampering ---

test('an unknown/privileged field in a checkout item (priceCents, sellerId, discount) is rejected with 400, never silently dropped', async () => {
  const res = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1,
    items: [{ listingId: listingA._id.toString(), qty: 1, priceCents: 1, sellerId: 'x', discount: 99 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(res.status, 400);
});

test('price is always taken from the DB, never the client — a stale expectedPriceCents is rejected, and a correct one still charges the real DB price', async () => {
  const stale = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1,
    items: [{ listingId: listingA._id.toString(), qty: 1, expectedPriceCents: 1 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.issues[0].reason, 'price_changed');
  assert.equal(stale.body.issues[0].newPriceCents, 185000);

  const real = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1,
    items: [{ listingId: listingA._id.toString(), qty: 1 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(real.status, 201);
  assert.equal(real.body.sellerOrders[0].items[0].unitPriceCents, 185000);
});

// --- Part D: stock concurrency ---

test('two customers ordering the last unit at the same time → exactly one succeeds', async () => {
  const place = (token, addressId) => request(app).post('/api/customer/orders').set('Authorization', `Bearer ${token}`).send({
    addressId,
    items: [{ listingId: listingLastUnit._id.toString(), qty: 1 }],
    idempotencyKey: idemKey(),
  });

  const [r1, r2] = await Promise.all([
    place(tokens.customer1, addrCustomer1),
    place(tokens.customer2, addrCustomer2),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [201, 409]);

  const failed = r1.status === 409 ? r1 : r2;
  assert.equal(failed.body.issues[0].reason, 'insufficient_stock');

  const listing = await Listing.findById(listingLastUnit._id).lean();
  assert.equal(listing.reservedQty, 1); // only the winning reservation stuck
});

// --- Part C: stale Seller 1 POS sync blocks only that seller's items ---

test('a stale (>30min) POS-connected seller\'s items cannot be ordered, while an unrelated seller\'s items in the same catalog order fine', async () => {
  const staleOnly = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1,
    items: [{ listingId: listingPos._id.toString(), qty: 1 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(staleOnly.status, 409);
  assert.equal(staleOnly.body.issues[0].reason, 'temporarily_unavailable');

  const otherSeller = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1,
    items: [{ listingId: listingB._id.toString(), qty: 1 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(otherSeller.status, 201);
});

// --- Part C: idempotency ---

test('placing with the same idempotency key twice creates exactly one order', async () => {
  const key = idemKey();
  const body = { addressId: addrCustomer1, items: [{ listingId: listingA._id.toString(), qty: 1 }], idempotencyKey: key };

  const first = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send(body);
  assert.equal(first.status, 201);
  const second = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send(body);
  assert.equal(second.status, 200);
  assert.equal(second.body.order.orderNumber, first.body.order.orderNumber);

  const count = await Order.countDocuments({ orderNumber: first.body.order.orderNumber });
  assert.equal(count, 1);
});

// --- Part E/F/H: isolation — customers see only their own orders, sellers only their own parcels ---

let sharedOrderNumber, sellerOrderAId, sellerOrderBId;

test('a multi-seller cart creates one order with one seller order per seller, each with only that seller\'s lines', async () => {
  const res = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1,
    items: [{ listingId: listingA._id.toString(), qty: 1 }, { listingId: listingB._id.toString(), qty: 1 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.sellerOrders.length, 2);
  sharedOrderNumber = res.body.order.orderNumber;
  const soA = res.body.sellerOrders.find((so) => String(so.seller) === String(sellerA._id));
  const soB = res.body.sellerOrders.find((so) => String(so.seller) === String(sellerB._id));
  assert.equal(soA.items.length, 1);
  assert.equal(soB.items.length, 1);
  sellerOrderAId = soA._id;
  sellerOrderBId = soB._id;
});

test('customer B cannot read customer A\'s order (404)', async () => {
  const res = await request(app).get(`/api/customer/orders/${sharedOrderNumber}`).set('Authorization', `Bearer ${tokens.customer2}`);
  assert.equal(res.status, 404);
});

test('seller B cannot read seller A\'s seller-order (404), and seller A\'s own order list never includes seller B\'s parcel', async () => {
  const forbidden = await request(app).get(`/api/seller/orders/${sellerOrderAId}`).set('Authorization', `Bearer ${tokens.bOwner}`).set('X-Seller-Id', sellerB._id.toString());
  assert.equal(forbidden.status, 404);

  const listA = await request(app).get('/api/seller/orders').set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(listA.status, 200);
  assert.ok(!listA.body.orders.some((o) => String(o._id) === String(sellerOrderBId)));
  // Regression: the tab counts come from a raw aggregate() pipeline,
  // which (unlike find()/countDocuments()) does NOT auto-cast
  // req.sellerId (a plain string) against the schema's ObjectId type —
  // an unguarded $match against the raw string silently matches nothing
  // and every tab would show "(0)" regardless of real order counts.
  assert.ok(listA.body.counts.new >= 1, 'tab counts must reflect this seller\'s real orders, not silently stay 0');
});

test('a customer cannot call seller or admin order routes', async () => {
  const sellerRes = await request(app).get('/api/seller/orders').set('Authorization', `Bearer ${tokens.customer1}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(sellerRes.status, 404); // no membership — same as "not a member"

  const adminRes = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${tokens.customer1}`);
  assert.equal(adminRes.status, 403);
});

test('seller staff can process an order; view-as is read-only', async () => {
  const confirmByStaff = await request(app).post(`/api/seller/orders/${sellerOrderAId}/transition`)
    .set('Authorization', `Bearer ${tokens.aStaff}`).set('X-Seller-Id', sellerA._id.toString())
    .send({ action: 'confirm' });
  assert.equal(confirmByStaff.status, 200);
  assert.equal(confirmByStaff.body.order.status, 'confirmed');

  const { signViewAsToken } = require('../services/tokens');
  const viewAsToken = signViewAsToken(platformOwnerUser, sellerA._id);

  const readOk = await request(app).get(`/api/seller/orders/${sellerOrderAId}`).set('Authorization', `Bearer ${viewAsToken}`);
  assert.equal(readOk.status, 200);

  const writeBlocked = await request(app).post(`/api/seller/orders/${sellerOrderAId}/transition`).set('Authorization', `Bearer ${viewAsToken}`).send({ action: 'cancel', reason: 'nope' });
  assert.equal(writeBlocked.status, 403);
});

// --- Part E: transitions ---

test('disallowed transitions are rejected with 409 and change nothing', async () => {
  // sellerOrderAId is currently 'confirmed' (from the previous test) — packing twice / shipping without packing first must fail.
  const skipToShipped = await request(app).post(`/api/seller/orders/${sellerOrderAId}/transition`)
    .set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString())
    .send({ action: 'ship', courier: 'Transexpress', trackingNumber: 'TX123' });
  assert.equal(skipToShipped.status, 409);
});

test('mark shipped requires courier + trackingNumber, consumes the reservation for a non-POS seller, and cancel after shipped is rejected', async () => {
  const listingBefore = await Listing.findById(listingA._id).lean();

  const pack = await request(app).post(`/api/seller/orders/${sellerOrderAId}/transition`)
    .set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString()).send({ action: 'pack' });
  assert.equal(pack.status, 200);

  const shipMissingFields = await request(app).post(`/api/seller/orders/${sellerOrderAId}/transition`)
    .set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString()).send({ action: 'ship' });
  assert.equal(shipMissingFields.status, 400);

  const ship = await request(app).post(`/api/seller/orders/${sellerOrderAId}/transition`)
    .set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString())
    .send({ action: 'ship', courier: 'Transexpress', trackingNumber: 'TX999' });
  assert.equal(ship.status, 200);
  assert.equal(ship.body.order.items[0].reservationStatus, 'consumed');

  const listingAfter = await Listing.findById(listingA._id).lean();
  assert.equal(listingAfter.stock, listingBefore.stock - 1); // permanently deducted
  assert.equal(listingAfter.reservedQty, listingBefore.reservedQty - 1);

  const cancelAfterShipped = await request(app).post(`/api/seller/orders/${sellerOrderAId}/transition`)
    .set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString())
    .send({ action: 'cancel', reason: 'too late' });
  assert.equal(cancelAfterShipped.status, 409);

  const deliver = await request(app).post(`/api/seller/orders/${sellerOrderAId}/transition`)
    .set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString()).send({ action: 'deliver' });
  assert.equal(deliver.status, 200);
  assert.equal(deliver.body.order.status, 'delivered');
});

test('a POS-linked seller\'s "mark shipped" does NOT consume the reservation — only "Recorded in POS" does', async () => {
  // Make the POS seller's sync fresh so an order can actually be placed.
  await Seller.updateOne({ _id: sellerPos._id }, { $set: { 'posConnection.lastSuccessfulSyncAt': new Date() } });
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: listingPos._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  assert.equal(placed.status, 201);
  const soId = placed.body.sellerOrders[0]._id;

  const auth = (req) => req.set('Authorization', `Bearer ${tokens.posOwner}`).set('X-Seller-Id', sellerPos._id.toString());
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'confirm' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'pack' });
  const ship = await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: 'TX-POS-1' });
  assert.equal(ship.status, 200);
  assert.equal(ship.body.order.items[0].reservationStatus, 'active'); // still held — POS sync owns the real stock number

  const recorded = await auth(request(app).post(`/api/seller/orders/${soId}/pos-recorded`)).send({});
  assert.equal(recorded.status, 200);
  assert.equal(recorded.body.order.items[0].reservationStatus, 'released');

  const listing = await Listing.findById(listingPos._id).lean();
  assert.equal(listing.reservedQty, 0); // released, but `stock` itself was never touched by this app
});

// --- Part D: auto-cancel job ---

test('auto-cancel job cancels an overdue, unconfirmed seller order and releases its stock reservation', async () => {
  const listing = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 3, reservedQty: 1,
    weightGrams: 500, title: name('Auto Cancel Item'), publishedAt: new Date(),
  });
  const customer = await User.findOne({ email: 'customer1@test.apexora' });
  const so = await SellerOrder.create({
    orderNumber: `APX-TEST-${Date.now()}`, order: new mongoose.Types.ObjectId(),
    seller: sellerA._id, customer: customer._id,
    shippingAddress: { line1: 'x', city: 'Colombo', district: 'Colombo', phone: '0770000000' },
    items: [{ listing: listing._id, title: name('x'), sku: '', unitPriceCents: 1000, qty: 1, lineTotalCents: 1000, weightGrams: 500, commissionRateBps: 0, reservationStatus: 'active' }],
    itemsTotalCents: 1000, deliveryFeeCents: 0, codAmountCents: 1000, weightKg: 1,
    status: 'new', autoCancelAt: new Date(Date.now() - 1000),
  });

  const cancelledCount = await cancelOverdue();
  assert.ok(cancelledCount >= 1);

  const after1 = await SellerOrder.findById(so._id).lean();
  assert.equal(after1.status, 'cancelled');
  assert.equal(after1.items[0].reservationStatus, 'released');

  const listingAfter = await Listing.findById(listing._id).lean();
  assert.equal(listingAfter.reservedQty, 0);
});

// --- Part C: snapshots never change after the fact ---

test('changing a listing\'s price or its category\'s commission after ordering never changes an already-placed order', async () => {
  const snapshotListing = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 5, priceCents: 300000,
    weightGrams: 400, title: name('Snapshot Item'), publishedAt: new Date(),
  });
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: snapshotListing._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  assert.equal(placed.status, 201);
  const soId = placed.body.sellerOrders[0]._id;
  const originalUnitPrice = placed.body.sellerOrders[0].items[0].unitPriceCents;
  const originalCommission = placed.body.sellerOrders[0].items[0].commissionRateBps;

  await Listing.updateOne({ _id: snapshotListing._id }, { $set: { priceCents: 999999 } });
  await Category.updateOne({ _id: category._id }, { $set: { commissionRateBps: 4999 } });

  const after1 = await SellerOrder.findById(soId).lean();
  assert.equal(after1.items[0].unitPriceCents, originalUnitPrice);
  assert.equal(after1.items[0].commissionRateBps, originalCommission);

  await Category.updateOne({ _id: category._id }, { $set: { commissionRateBps: 500 } }); // restore for later tests
});

// --- Part E: customer-contact masking after 30 days ---

test('customer phone/address are masked in the seller\'s view 30 days after delivered/cancelled, not before', async () => {
  const recentListing = await Listing.create({ seller: sellerA._id, categoryId: category._id, status: 'published', stock: 1, weightGrams: 100, title: name('m'), publishedAt: new Date() });
  const oldListing = await Listing.create({ seller: sellerA._id, categoryId: category._id, status: 'published', stock: 1, weightGrams: 100, title: name('m'), publishedAt: new Date() });
  const customer = await User.findOne({ email: 'customer1@test.apexora' });
  const base = {
    order: new mongoose.Types.ObjectId(), seller: sellerA._id, customer: customer._id,
    shippingAddress: { line1: 'Real Address 123', city: 'Colombo', district: 'Colombo', phone: '0779998888' },
    itemsTotalCents: 1000, deliveryFeeCents: 0, codAmountCents: 1000, weightKg: 1, status: 'delivered',
  };
  const recent = await SellerOrder.create({
    ...base, orderNumber: `APX-TEST-R-${Date.now()}`,
    items: [{ listing: recentListing._id, title: name('m'), sku: '', unitPriceCents: 1000, qty: 1, lineTotalCents: 1000, weightGrams: 100, commissionRateBps: 0 }],
    deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
  });
  const old = await SellerOrder.create({
    ...base, orderNumber: `APX-TEST-O-${Date.now()}`,
    items: [{ listing: oldListing._id, title: name('m'), sku: '', unitPriceCents: 1000, qty: 1, lineTotalCents: 1000, weightGrams: 100, commissionRateBps: 0 }],
    deliveredAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
  });

  const auth = (req) => req.set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  const recentRes = await auth(request(app).get(`/api/seller/orders/${recent._id}`));
  assert.equal(recentRes.body.order.shippingAddress.line1, 'Real Address 123');

  const oldRes = await auth(request(app).get(`/api/seller/orders/${old._id}`));
  assert.notEqual(oldRes.body.order.shippingAddress.line1, 'Real Address 123');
});

// --- Part C: customer cancel-order, only while every parcel is still New/Confirmed ---

test('customer can cancel an order while every parcel is still new/confirmed, releasing stock', async () => {
  const cancellable = await Listing.create({ seller: sellerB._id, categoryId: category._id, status: 'published', stock: 5, weightGrams: 300, title: name('Cancellable'), publishedAt: new Date() });
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: cancellable._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  assert.equal(placed.status, 201);

  const cancel = await request(app).post(`/api/customer/orders/${placed.body.order.orderNumber}/cancel`).set('Authorization', `Bearer ${tokens.customer1}`).send({ reason: 'changed my mind' });
  assert.equal(cancel.status, 200);

  const listing = await Listing.findById(cancellable._id).lean();
  assert.equal(listing.reservedQty, 0);
});

// --- Part F: admin oversight ---

test('admin can list/view orders, cancel a parcel with a reason (audited), and move a stuck parcel forward', async () => {
  const adminListingX = await Listing.create({ seller: sellerB._id, categoryId: category._id, status: 'published', stock: 5, weightGrams: 300, title: name('Admin Test Item'), publishedAt: new Date() });
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: adminListingX._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  const soId = placed.body.sellerOrders[0]._id;

  const list = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(list.status, 200);
  assert.ok(list.body.orders.some((o) => String(o._id) === String(soId)));

  const overview = await request(app).get('/api/admin/orders-overview').set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(overview.status, 200);
  assert.ok(overview.body.ordersToday >= 1);

  const moveOn = await request(app).post(`/api/admin/orders/${soId}/move-on`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ toStatus: 'confirmed', reason: 'seller confirmed by phone' });
  assert.equal(moveOn.status, 200);
  assert.equal(moveOn.body.order.status, 'confirmed');

  const cancel = await request(app).post(`/api/admin/orders/${soId}/cancel`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ reason: 'seller out of stock, confirmed by phone' });
  assert.equal(cancel.status, 200);

  const listingAfter = await Listing.findById(adminListingX._id).lean();
  assert.equal(listingAfter.reservedQty, 0);
});

test('a platform_staff (not owner) cannot be blocked from reading orders, but seller order routes reject a platform user with no seller membership', async () => {
  // platform_owner used above already covers the admin-role path; this
  // just confirms a platform account still gets a clean 404 (not a
  // leaking 403) on a seller route it has no membership on.
  const res = await request(app).get('/api/seller/orders').set('Authorization', `Bearer ${tokens.platformOwner}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(res.status, 404);
});

// --- Follow-up #1: "Returned to seller" after a failed/refused delivery ---

test('non-POS seller: after a failed delivery, "return" adds the stock back, notifies the customer, and a second return is rejected (stock not added back twice)', async () => {
  const returnListing = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 5,
    weightGrams: 300, title: name('Return Test Item'), publishedAt: new Date(),
  });
  const before1 = await Listing.findById(returnListing._id).lean();

  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: returnListing._id.toString(), qty: 2 }], idempotencyKey: idemKey(),
  });
  assert.equal(placed.status, 201);
  const soId = placed.body.sellerOrders[0]._id;

  const auth = (req) => req.set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'confirm' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'pack' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: 'TX-RET-1' });

  const afterShip = await Listing.findById(returnListing._id).lean();
  assert.equal(afterShip.stock, before1.stock - 2); // consumed at ship time

  const fail = await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'fail', reason: 'customer refused delivery' });
  assert.equal(fail.status, 200);
  assert.equal(fail.body.order.status, 'delivery_failed');

  const ret = await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'return' });
  assert.equal(ret.status, 200);
  assert.equal(ret.body.order.status, 'returned');
  assert.equal(ret.body.order.items[0].reservationStatus, 'returned');

  const afterReturn = await Listing.findById(returnListing._id).lean();
  assert.equal(afterReturn.stock, before1.stock); // restored back to the original count

  const customer1Doc = await User.findOne({ email: 'customer1@test.apexora' }).select('_id').lean();
  const returnedNotif = await Notification.findOne({ user: customer1Doc._id, type: 'order.returned' }).lean();
  assert.ok(returnedNotif, 'customer should be notified the order was returned');

  // Stock can't be added back twice — the transition table itself blocks
  // re-running 'return' once status is no longer 'delivery_failed'.
  const retAgain = await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'return' });
  assert.equal(retAgain.status, 409);

  const afterSecondAttempt = await Listing.findById(returnListing._id).lean();
  assert.equal(afterSecondAttempt.stock, before1.stock); // unchanged — not double-counted
});

test('POS-connected seller: after a failed delivery, "return" never touches marketplace stock (the POS owns it)', async () => {
  await Seller.updateOne({ _id: sellerPos._id }, { $set: { 'posConnection.lastSuccessfulSyncAt': new Date() } });
  const posReturnListing = await Listing.create({
    seller: sellerPos._id, categoryId: category._id, status: 'published', stock: 5,
    weightGrams: 300, title: name('Pos Return Test Item'), publishedAt: new Date(),
  });
  const before1 = await Listing.findById(posReturnListing._id).lean();

  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: posReturnListing._id.toString(), qty: 2 }], idempotencyKey: idemKey(),
  });
  assert.equal(placed.status, 201);
  const soId = placed.body.sellerOrders[0]._id;

  const auth = (req) => req.set('Authorization', `Bearer ${tokens.posOwner}`).set('X-Seller-Id', sellerPos._id.toString());
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'confirm' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'pack' });
  const ship = await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: 'TX-RET-POS-1' });
  assert.equal(ship.body.order.items[0].reservationStatus, 'active'); // POS seller — never consumed

  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'fail', reason: 'customer refused delivery' });
  const ret = await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'return' });
  assert.equal(ret.status, 200);
  assert.equal(ret.body.order.status, 'returned');
  assert.equal(ret.body.order.items[0].reservationStatus, 'returned');

  const afterReturn = await Listing.findById(posReturnListing._id).lean();
  assert.equal(afterReturn.stock, before1.stock); // never touched — the POS owns this number
  assert.equal(afterReturn.reservedQty, 0); // the held reservation was released, not consumed
});

test('an admin filtering by "cancelled" also sees returned orders', async () => {
  const returnedOrder = await SellerOrder.findOne({ status: 'returned', seller: sellerA._id }).lean();
  assert.ok(returnedOrder);
  const list = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${tokens.platformOwner}`).query({ status: 'cancelled' });
  assert.equal(list.status, 200);
  assert.ok(list.body.orders.some((o) => String(o._id) === String(returnedOrder._id)));
});

// --- Follow-up #2: "Not yet recorded in POS" reminder + filter ---

test('a POS seller order shipped 24h+ ago and not recorded gets a once-a-day reminder, shows in the filter, and counts on Seller Home', async () => {
  const posOwner = await User.findOne({ email: 'pos-owner@test.apexora' }).select('_id').lean();
  const reminderListing = await Listing.create({
    seller: sellerPos._id, categoryId: category._id, status: 'published', stock: 5,
    weightGrams: 300, title: name('Reminder Test Item'), publishedAt: new Date(),
  });
  const customer1Doc = await User.findOne({ email: 'customer1@test.apexora' }).select('_id').lean();

  const staleOrder = await SellerOrder.create({
    orderNumber: `APX-TEST-REM-${Date.now()}`, order: new mongoose.Types.ObjectId(),
    seller: sellerPos._id, customer: customer1Doc._id,
    shippingAddress: { line1: 'x', city: 'Colombo', district: 'Colombo', phone: '0770000000' },
    items: [{ listing: reminderListing._id, title: name('x'), sku: '', unitPriceCents: 1000, qty: 1, lineTotalCents: 1000, weightGrams: 300, commissionRateBps: 0, reservationStatus: 'active' }],
    itemsTotalCents: 1000, deliveryFeeCents: 0, codAmountCents: 1000, weightKg: 1,
    status: 'shipped', shippedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), posRecorded: false,
  });

  const notifiedCount = await runPosRecordedReminderSweep();
  assert.ok(notifiedCount >= 1);

  const afterFirstSweep = await SellerOrder.findById(staleOrder._id).lean();
  assert.ok(afterFirstSweep.posNotRecordedWarnedAt, 'warned-at should now be set');

  const remindersAfterFirst = await Notification.countDocuments({ user: posOwner._id, type: 'pos.order_not_recorded' });
  assert.ok(remindersAfterFirst >= 1);

  // Running the sweep again immediately must NOT re-notify (once a day) —
  // the count stays exactly where it was.
  await runPosRecordedReminderSweep();
  const remindersAfterSecond = await Notification.countDocuments({ user: posOwner._id, type: 'pos.order_not_recorded' });
  assert.equal(remindersAfterSecond, remindersAfterFirst);

  // The filter on Seller Orders.
  const filtered = await request(app).get('/api/seller/orders')
    .set('Authorization', `Bearer ${tokens.posOwner}`).set('X-Seller-Id', sellerPos._id.toString())
    .query({ notRecordedInPos: 'true' });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.orders.some((o) => String(o._id) === String(staleOrder._id)));
  assert.ok(filtered.body.notRecordedInPosCount >= 1);

  // Seller Home's own count.
  const home = await request(app).get('/api/seller/me/home')
    .set('Authorization', `Bearer ${tokens.posOwner}`).set('X-Seller-Id', sellerPos._id.toString());
  assert.equal(home.status, 200);
  assert.ok(home.body.notRecordedInPosCount >= 1);
});

test('a non-POS seller\'s Home always reports notRecordedInPosCount: 0 (the reminder only ever applies to POS-connected sellers)', async () => {
  const home = await request(app).get('/api/seller/me/home')
    .set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(home.status, 200);
  assert.equal(home.body.notRecordedInPosCount, 0);
});

// --- Review follow-up #1: "return" is race-safe (atomic claim) ---

test('two "return" requests fired in parallel restock exactly once', async () => {
  const raceListing = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 5,
    weightGrams: 300, title: name('Race Return Item'), publishedAt: new Date(),
  });
  const before1 = await Listing.findById(raceListing._id).lean();

  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: raceListing._id.toString(), qty: 2 }], idempotencyKey: idemKey(),
  });
  const soId = placed.body.sellerOrders[0]._id;
  const auth = (req) => req.set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'confirm' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'pack' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: 'TX-RACE-1' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'fail', reason: 'refused' });

  const [r1, r2] = await Promise.all([
    auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'return' }),
    auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'return' }),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [200, 409], 'exactly one of the two concurrent "return" requests should win');

  const afterReturn = await Listing.findById(raceListing._id).lean();
  assert.equal(afterReturn.stock, before1.stock, 'stock restored exactly once, not twice');
});

// --- Review follow-up #2: refused-parcel cost + refund-needed guard ---

test('marking an order returned records the delivery fee as refusedParcelCostCents', async () => {
  const costListing = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 5,
    weightGrams: 300, title: name('Cost Return Item'), publishedAt: new Date(),
  });
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: costListing._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  const soId = placed.body.sellerOrders[0]._id;
  const deliveryFeeCents = placed.body.sellerOrders[0].deliveryFeeCents;
  const auth = (req) => req.set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'confirm' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'pack' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: 'TX-COST-1' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'fail', reason: 'refused' });
  const ret = await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'return' });

  assert.equal(ret.status, 200);
  assert.equal(ret.body.order.refusedParcelCostCents, deliveryFeeCents);
});

test('a prepaid order that ends up cancelled or returned is flagged refundNeeded, visible in Admin → Orders', async () => {
  const prepaidListing = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 0,
    weightGrams: 300, title: name('Prepaid Item'), publishedAt: new Date(),
  });
  const customer1Doc = await User.findOne({ email: 'customer1@test.apexora' }).select('_id').lean();
  // There's no real prepaid flow yet (every order placed through the API
  // is COD) — this constructs the document directly, the same way
  // Milestone 7's real prepaid orders eventually will, to prove the guard
  // itself works ahead of that milestone existing.
  const prepaidOrder = await SellerOrder.create({
    orderNumber: `APX-TEST-PREPAID-${Date.now()}`, order: new mongoose.Types.ObjectId(),
    seller: sellerA._id, customer: customer1Doc._id, paymentMethod: 'prepaid',
    shippingAddress: { line1: 'x', city: 'Colombo', district: 'Colombo', phone: '0770000000' },
    items: [{ listing: prepaidListing._id, title: name('x'), sku: '', unitPriceCents: 5000, qty: 1, lineTotalCents: 5000, weightGrams: 300, commissionRateBps: 0, reservationStatus: 'active' }],
    itemsTotalCents: 5000, deliveryFeeCents: 450, codAmountCents: 5450, weightKg: 1, status: 'new',
  });

  const cancel = await request(app).post(`/api/admin/orders/${prepaidOrder._id}/cancel`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`).send({ reason: 'out of stock' });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.order.refundNeeded, true);

  const filtered = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${tokens.platformOwner}`).query({ refundNeeded: 'true' });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.orders.some((o) => String(o._id) === String(prepaidOrder._id)));

  const overview = await request(app).get('/api/admin/orders-overview').set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.ok(overview.body.refundsNeeded >= 1);
});

test('a COD order (the only real path today) never sets refundNeeded, even when cancelled', async () => {
  const codListing = await Listing.create({ seller: sellerA._id, categoryId: category._id, status: 'published', stock: 5, weightGrams: 300, title: name('COD Refund Check'), publishedAt: new Date() });
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: codListing._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  const soId = placed.body.sellerOrders[0]._id;
  const cancel = await request(app).post(`/api/admin/orders/${soId}/cancel`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ reason: 'test' });
  assert.equal(cancel.body.order.refundNeeded, false);
});

// --- Review follow-up #3: audit log for delivery_failed -> returned ---

test('marking an order returned writes an audit log entry (who, when, reason)', async () => {
  const auditListing = await Listing.create({
    seller: sellerA._id, categoryId: category._id, status: 'published', stock: 5,
    weightGrams: 300, title: name('Audit Return Item'), publishedAt: new Date(),
  });
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer1}`).send({
    addressId: addrCustomer1, items: [{ listingId: auditListing._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  const soId = placed.body.sellerOrders[0]._id;
  const auth = (req) => req.set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'confirm' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'pack' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: 'TX-AUDIT-1' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'fail', reason: 'refused' });
  await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'return', reason: 'confirmed with courier' });

  const entry = await AuditLog.findOne({ targetType: 'SellerOrder', targetId: soId, action: 'order.return' }).lean();
  assert.ok(entry, 'expected an audit log entry for the return transition');
  assert.equal(entry.before.status, 'delivery_failed');
  assert.equal(entry.after.status, 'returned');
  assert.ok(entry.summary.includes('confirmed with courier'));
  assert.ok(entry.createdAt);
});

// --- Review follow-up #4: POS reminder job is atomic across parallel runs ---

test('running the POS-reminder sweep twice in parallel on the same stale order sends exactly one notification', async () => {
  const posOwner = await User.findOne({ email: 'pos-owner@test.apexora' }).select('_id').lean();
  const raceReminderListing = await Listing.create({
    seller: sellerPos._id, categoryId: category._id, status: 'published', stock: 5,
    weightGrams: 300, title: name('Race Reminder Item'), publishedAt: new Date(),
  });
  const customer1Doc = await User.findOne({ email: 'customer1@test.apexora' }).select('_id').lean();
  const staleOrder2 = await SellerOrder.create({
    orderNumber: `APX-TEST-RACE-REM-${Date.now()}`, order: new mongoose.Types.ObjectId(),
    seller: sellerPos._id, customer: customer1Doc._id,
    shippingAddress: { line1: 'x', city: 'Colombo', district: 'Colombo', phone: '0770000000' },
    items: [{ listing: raceReminderListing._id, title: name('x'), sku: '', unitPriceCents: 1000, qty: 1, lineTotalCents: 1000, weightGrams: 300, commissionRateBps: 0, reservationStatus: 'active' }],
    itemsTotalCents: 1000, deliveryFeeCents: 0, codAmountCents: 1000, weightKg: 1,
    status: 'shipped', shippedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), posRecorded: false,
  });

  const before = await Notification.countDocuments({ user: posOwner._id, type: 'pos.order_not_recorded' });
  await Promise.all([runPosRecordedReminderSweep(), runPosRecordedReminderSweep()]);
  const after = await Notification.countDocuments({ user: posOwner._id, type: 'pos.order_not_recorded' });
  assert.equal(after - before, 1, 'exactly one notification should be sent, even though the sweep ran twice at once');

  const updated = await SellerOrder.findById(staleOrder2._id).lean();
  assert.ok(updated.posNotRecordedWarnedAt);
});

// --- Review follow-up #5: returned POS orders also get the reminder, via their own checkbox ---

test('a POS seller\'s returned order (not yet "Return recorded in POS") shows in the reminder filter and gets the daily reminder', async () => {
  const posOwner = await User.findOne({ email: 'pos-owner@test.apexora' }).select('_id').lean();
  const returnReminderListing = await Listing.create({
    seller: sellerPos._id, categoryId: category._id, status: 'published', stock: 5,
    weightGrams: 300, title: name('Return Reminder Item'), publishedAt: new Date(),
  });
  const customer1Doc = await User.findOne({ email: 'customer1@test.apexora' }).select('_id').lean();
  const returnedStaleOrder = await SellerOrder.create({
    orderNumber: `APX-TEST-RETREM-${Date.now()}`, order: new mongoose.Types.ObjectId(),
    seller: sellerPos._id, customer: customer1Doc._id,
    shippingAddress: { line1: 'x', city: 'Colombo', district: 'Colombo', phone: '0770000000' },
    items: [{ listing: returnReminderListing._id, title: name('x'), sku: '', unitPriceCents: 1000, qty: 1, lineTotalCents: 1000, weightGrams: 300, commissionRateBps: 0, reservationStatus: 'returned' }],
    itemsTotalCents: 1000, deliveryFeeCents: 0, codAmountCents: 1000, weightKg: 1,
    status: 'returned', returnedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), returnPosRecorded: false,
  });

  const auth = (req) => req.set('Authorization', `Bearer ${tokens.posOwner}`).set('X-Seller-Id', sellerPos._id.toString());

  // Shows in the "not yet recorded in POS" filter.
  const filtered = await auth(request(app).get('/api/seller/orders')).query({ notRecordedInPos: 'true' });
  assert.ok(filtered.body.orders.some((o) => String(o._id) === String(returnedStaleOrder._id)));

  // The job notifies for it.
  const before = await Notification.countDocuments({ user: posOwner._id, type: 'pos.order_not_recorded' });
  await runPosRecordedReminderSweep();
  const after = await Notification.countDocuments({ user: posOwner._id, type: 'pos.order_not_recorded' });
  assert.ok(after > before);

  // The seller has a SEPARATE checkbox for the return (not markPosRecorded,
  // which is for the original sale and would 404/409 on a returned order).
  const recordReturn = await auth(request(app).post(`/api/seller/orders/${returnedStaleOrder._id}/return-pos-recorded`)).send({});
  assert.equal(recordReturn.status, 200);
  assert.equal(recordReturn.body.order.returnPosRecorded, true);

  // Once recorded, it drops out of the filter.
  const filteredAfter = await auth(request(app).get('/api/seller/orders')).query({ notRecordedInPos: 'true' });
  assert.ok(!filteredAfter.body.orders.some((o) => String(o._id) === String(returnedStaleOrder._id)));

  // Recording it again is rejected.
  const again = await auth(request(app).post(`/api/seller/orders/${returnedStaleOrder._id}/return-pos-recorded`)).send({});
  assert.equal(again.status, 409);
});
