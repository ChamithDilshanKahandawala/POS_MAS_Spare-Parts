// Milestone 8 — returns & disputes. Own fixtures, own process (see helpers.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, User, Category, Listing, PlatformSettings, SellerOrder, Order, LedgerEntry, Notification, ReturnRequest, mongoose,
} = require('./helpers');
const { escalateOverdueRequests } = require('../services/returns');

const name = (en) => ({ en, si: '', ta: '' });
const idemKey = () => `idem8-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const trackingKey = () => `TX8-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const DAY = 24 * 60 * 60 * 1000;

let returnable, nonReturnable;
let sellerA, sellerB;
let listingA, listingOdd, listingNR, listingB;
let tokens = {};
let addrCustomer;
let ownerUser;

const sellerAuth = (req, seller, token) => req.set('Authorization', `Bearer ${token}`).set('X-Seller-Id', seller._id.toString());

// Places an order and drives it to 'delivered' through the real seller routes.
async function placeAndDeliver({ seller, sellerToken, listing, qty = 1 }) {
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer}`).send({
    addressId: addrCustomer,
    items: [{ listingId: listing._id.toString(), qty }],
    idempotencyKey: idemKey(),
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const so = placed.body.sellerOrders.find((x) => x.seller === seller._id.toString() || x.seller?._id === seller._id.toString());
  const soId = so._id;
  const act = (body) => sellerAuth(request(app).post(`/api/seller/orders/${soId}/transition`), seller, sellerToken).send(body);
  assert.equal((await act({ action: 'confirm' })).status, 200);
  assert.equal((await act({ action: 'pack' })).status, 200);
  assert.equal((await act({ action: 'ship', courier: 'Transexpress', trackingNumber: trackingKey() })).status, 200);
  assert.equal((await act({ action: 'deliver' })).status, 200);
  return SellerOrder.findById(soId).lean();
}

async function requestReturn({ sellerOrderId, lines, reason = 'damaged', note = '' }) {
  return request(app)
    .post('/api/customer/returns')
    .set('Authorization', `Bearer ${tokens.customer}`)
    .field('sellerOrderId', sellerOrderId.toString())
    .field('reason', reason)
    .field('customerNote', note)
    .field('lines', JSON.stringify(lines));
}

async function freshStepUp(userId) {
  await User.updateOne({ _id: userId }, { $set: { stepUpVerifiedAt: new Date() } });
}

const adminRefund = (id, body, token = tokens.owner) =>
  request(app).post(`/api/admin/returns/${id}/refund`).set('Authorization', `Bearer ${token}`).send(body);

before(async () => {
  await wipeDatabase();

  ownerUser = await createUser({ name: 'Platform Owner', email: 'owner8@test.apexora', platformRole: 'platform_owner' });
  await createUser({ name: 'Platform Staff', email: 'staff8@test.apexora', platformRole: 'platform_staff' });
  const aOwner = await createUser({ name: 'A Owner', email: 'a-owner8@test.apexora' });
  const bOwner = await createUser({ name: 'B Owner', email: 'b-owner8@test.apexora' });
  const customer = await createUser({ name: 'Customer', email: 'customer8@test.apexora' });

  returnable = await Category.create({
    name: name('Returnable Parts'), slug: 'returnable-m8', depth: 0, active: true, commissionRateBps: 500,
    returnPolicy: { returnable: true, windowDays: 7 },
  });
  nonReturnable = await Category.create({
    name: name('Final Sale'), slug: 'final-sale-m8', depth: 0, active: true, commissionRateBps: 500,
    returnPolicy: { returnable: false, windowDays: 0 },
  });

  sellerA = await Seller.create({ name: 'Seller A', legalName: 'Seller A Ltd', brNumber: 'BR-A8', status: 'active', slug: 'seller-a-m8' });
  sellerB = await Seller.create({ name: 'Seller B', legalName: 'Seller B Ltd', brNumber: 'BR-B8', status: 'active', slug: 'seller-b-m8' });

  await SellerMember.create({ user: aOwner._id, seller: sellerA._id, role: 'seller_owner' });
  await SellerMember.create({ user: bOwner._id, seller: sellerB._id, role: 'seller_owner' });

  tokens.owner = (await loginFlow('owner8@test.apexora')).accessToken;
  tokens.staff = (await loginFlow('staff8@test.apexora')).accessToken;
  tokens.aOwner = (await loginFlow('a-owner8@test.apexora')).accessToken;
  tokens.bOwner = (await loginFlow('b-owner8@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('customer8@test.apexora')).accessToken;

  const c = await User.findById(customer._id);
  c.addresses.push({ line1: '8 Return Lane', city: 'Colombo', district: 'Colombo', phone: '0770000008', isDefault: true });
  await c.save();
  addrCustomer = c.addresses[0]._id.toString();

  await PlatformSettings.create({
    _id: 'platform-settings', onlineOrderingEnabled: true, payoutHoldDays: 3,
    defaultReturnWindowDays: 7, returnResponseDays: 2, minimumPayoutCents: 1000,
  });

  listingA = await Listing.create({ seller: sellerA._id, categoryId: returnable._id, status: 'published', stock: 50, priceCents: 100000, weightGrams: 500, title: name('Item A'), publishedAt: new Date() });
  listingOdd = await Listing.create({ seller: sellerA._id, categoryId: returnable._id, status: 'published', stock: 50, priceCents: 33333, weightGrams: 500, title: name('Item Odd'), publishedAt: new Date() });
  listingNR = await Listing.create({ seller: sellerA._id, categoryId: nonReturnable._id, status: 'published', stock: 50, priceCents: 40000, weightGrams: 500, title: name('Item Final'), publishedAt: new Date() });
  listingB = await Listing.create({ seller: sellerB._id, categoryId: returnable._id, status: 'published', stock: 50, priceCents: 200000, weightGrams: 500, title: name('Item B'), publishedAt: new Date() });
});

after(async () => {
  await mongoose.disconnect();
});

// --- Eligibility ---

test('a return is refused until the order has been delivered', async () => {
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer}`).send({
    addressId: addrCustomer,
    items: [{ listingId: listingA._id.toString(), qty: 1 }],
    idempotencyKey: idemKey(),
  });
  assert.equal(placed.status, 201);
  const so = placed.body.sellerOrders[0];
  const res = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id, qty: 1 }] });
  assert.equal(res.status, 409);
  assert.match(res.body.message, /delivered/);
});

test('an item in a non-returnable category cannot be returned', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingNR });
  const res = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  assert.equal(res.status, 409);
  assert.match(res.body.message, /not eligible/);
});

test('a return is refused once the return window has closed', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA });
  await SellerOrder.updateOne({ _id: so._id }, { $set: { deliveredAt: new Date(Date.now() - 8 * DAY) } });
  const res = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  assert.equal(res.status, 409);
  assert.match(res.body.message, /window/);
});

test('quantity above what was delivered is refused', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 1 });
  const res = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 2 }] });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /at most 1/);
});

// --- Creating a request, one open request per line ---

test('a valid return claims its line; a second open request on the same line is refused', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const itemId = so.items[0]._id.toString();

  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId, qty: 1 }] });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.returnRequest.status, 'requested');
  assert.equal(created.body.returnRequest.refundItemsCents, 100000);

  const after1 = await SellerOrder.findById(so._id).lean();
  assert.equal(String(after1.items[0].openReturnRequest), created.body.returnRequest._id);

  const dup = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId, qty: 1 }] });
  assert.equal(dup.status, 409);

  const sellerNotes = await Notification.countDocuments({ type: 'return.requested' });
  assert.ok(sellerNotes >= 1, 'seller owner is notified of the request');
});

test('two simultaneous requests for the same line: exactly one wins', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const lines = [{ itemId: so.items[0]._id.toString(), qty: 1 }];
  const [r1, r2] = await Promise.all([
    requestReturn({ sellerOrderId: so._id, lines }),
    requestReturn({ sellerOrderId: so._id, lines }),
  ]);
  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [201, 409]);
  const count = await ReturnRequest.countDocuments({ sellerOrder: so._id });
  assert.equal(count, 1);
});

// --- Seller response, permissions, and the state machine ---

test('a seller can only see and answer its own returns; a rejection needs a reason', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA });
  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  const rid = created.body.returnRequest._id;

  const seesA = await sellerAuth(request(app).get(`/api/seller/returns/${rid}`), sellerA, tokens.aOwner);
  assert.equal(seesA.status, 200);

  const seesB = await sellerAuth(request(app).get(`/api/seller/returns/${rid}`), sellerB, tokens.bOwner);
  assert.equal(seesB.status, 404);

  const respondB = await sellerAuth(request(app).post(`/api/seller/returns/${rid}/respond`), sellerB, tokens.bOwner).send({ accept: false, note: 'no' });
  assert.equal(respondB.status, 404);

  const noReason = await sellerAuth(request(app).post(`/api/seller/returns/${rid}/respond`), sellerA, tokens.aOwner).send({ accept: false });
  assert.equal(noReason.status, 400);
});

test('simultaneous accept and reject: exactly one response is recorded', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  const rid = created.body.returnRequest._id;
  const respond = (body) => sellerAuth(request(app).post(`/api/seller/returns/${rid}/respond`), sellerA, tokens.aOwner).send(body);
  const [a, b] = await Promise.all([respond({ accept: true }), respond({ accept: false, note: 'Not as described' })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const rr = await ReturnRequest.findById(rid).lean();
  assert.ok(['seller_accepted', 'seller_rejected'].includes(rr.status));
});

// --- Full money path: accept → received → refund ---

test('a full refund reverses the sale and commission, charges return shipping to the seller, and needs a fresh step-up', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA });
  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  const rid = created.body.returnRequest._id;

  await sellerAuth(request(app).post(`/api/seller/returns/${rid}/respond`), sellerA, tokens.aOwner).send({ accept: true }).expect(200);

  const stockBefore = (await Listing.findById(listingA._id).lean()).stock;
  const received = await sellerAuth(request(app).post(`/api/seller/returns/${rid}/received`), sellerA, tokens.aOwner).send({});
  assert.equal(received.status, 200, JSON.stringify(received.body));
  assert.equal(received.body.returnRequest.status, 'item_returned');
  const stockAfter = (await Listing.findById(listingA._id).lean()).stock;
  assert.equal(stockAfter, stockBefore + 1, 'non-POS seller gets the returned unit back into stock');

  const body = { payer: 'seller', shippingCents: 70000, method: 'bank_transfer', reference: 'BT-8001' };
  const noStepUp = await adminRefund(rid, body);
  assert.equal(noStepUp.status, 403);

  await freshStepUp(ownerUser._id);
  const staffTry = await adminRefund(rid, body, tokens.staff);
  assert.equal(staffTry.status, 403, 'only the platform owner may mark a refund paid');

  const done = await adminRefund(rid, body);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.returnRequest.status, 'refunded');
  assert.equal(done.body.returnRequest.resolution.customerRefundCents, 100000);

  const entries = await LedgerEntry.find({ sellerOrder: so._id, type: { $regex: /^return_/ } }).lean();
  const byType = Object.fromEntries(entries.map((e) => [e.type, e.amountCents]));
  assert.equal(byType.return_refund, -100000);
  assert.equal(byType.return_commission_reversal, 5000, 'full refund reverses the full 5% commission');
  assert.equal(byType.return_shipping, -70000);

  const soAfter = await SellerOrder.findById(so._id).lean();
  assert.equal(soAfter.items[0].refundedQty, 1);
  assert.equal(soAfter.items[0].openReturnRequest, null, 'line is released once refunded');
});

test('a refund is only possible once, and only from item_returned', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  const rid = created.body.returnRequest._id;
  await freshStepUp(ownerUser._id);
  const early = await adminRefund(rid, { payer: 'platform', shippingCents: 0, method: 'cash', reference: 'R1' });
  assert.equal(early.status, 409);
});

// --- Rounding: partial refunds reverse commission exactly, never drifting ---

test('partial refunds reverse commission proportionally and sum exactly to the original commission', async () => {
  // Three units at 33333 cents: items total 99999, commission round(99999 × 5%) = 5000.
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingOdd, qty: 3 });
  const commissionEntry = await LedgerEntry.findOne({ sellerOrder: so._id, type: 'commission' }).lean();
  assert.equal(commissionEntry.amountCents, -5000);
  const itemId = so.items[0]._id.toString();

  await freshStepUp(ownerUser._id);
  const reversals = [];
  for (let i = 0; i < 3; i += 1) {
    const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId, qty: 1 }] });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const rid = created.body.returnRequest._id;
    await sellerAuth(request(app).post(`/api/seller/returns/${rid}/respond`), sellerA, tokens.aOwner).send({ accept: true }).expect(200);
    await sellerAuth(request(app).post(`/api/seller/returns/${rid}/received`), sellerA, tokens.aOwner).send({}).expect(200);
    const done = await adminRefund(rid, { payer: 'platform', shippingCents: 0, method: 'bank_transfer', reference: `P-${i}` });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    const latest = await LedgerEntry.find({ sellerOrder: so._id, type: 'return_commission_reversal' }).sort({ createdAt: -1 }).limit(1).lean();
    reversals.push(latest[0].amountCents);
  }

  // Cumulative targets: round(33333×5000/99999)=1667, round(66666×5000/99999)=3333, round(99999×5000/99999)=5000.
  assert.deepEqual(reversals, [1667, 1666, 1667]);
  const total = reversals.reduce((s, n) => s + n, 0);
  assert.equal(total, 5000, 'total reversal equals the original commission to the cent');
});

// --- Dismiss, seller rejection, and the deadline ---

test('a rejected return dismissed by the platform releases its line for a new request', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const itemId = so.items[0]._id.toString();
  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId, qty: 1 }] });
  const rid = created.body.returnRequest._id;

  await sellerAuth(request(app).post(`/api/seller/returns/${rid}/respond`), sellerA, tokens.aOwner).send({ accept: false, note: 'Item is fine' }).expect(200);

  const decideNoNote = await request(app).post(`/api/admin/returns/${rid}/decide`).set('Authorization', `Bearer ${tokens.staff}`).send({ decision: 'dismiss', note: '' });
  assert.equal(decideNoNote.status, 400);

  const dismissed = await request(app).post(`/api/admin/returns/${rid}/decide`).set('Authorization', `Bearer ${tokens.staff}`).send({ decision: 'dismiss', note: 'Photos show no defect' });
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.body.returnRequest.status, 'closed');

  const again = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId, qty: 1 }] });
  assert.equal(again.status, 201, 'the line is free again after the request is closed');
});

test('a seller who misses the deadline is escalated to the platform, which can then uphold it', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  const rid = created.body.returnRequest._id;

  await ReturnRequest.updateOne({ _id: rid }, { $set: { responseDeadlineAt: new Date(Date.now() - 1000) } });
  const escalated = await escalateOverdueRequests();
  assert.ok(escalated >= 1);
  assert.equal((await ReturnRequest.findById(rid).lean()).status, 'escalated');
  assert.ok(await Notification.exists({ type: 'return.escalated' }));

  const decided = await request(app).post(`/api/admin/returns/${rid}/decide`).set('Authorization', `Bearer ${tokens.staff}`).send({ decision: 'uphold', note: 'Customer is right' });
  assert.equal(decided.status, 200);
  assert.equal(decided.body.returnRequest.status, 'admin_decided');

  const received = await sellerAuth(request(app).post(`/api/seller/returns/${rid}/received`), sellerA, tokens.aOwner).send({});
  assert.equal(received.status, 200, 'an upheld return can be received after an admin decision');
});

// --- Refund carries over without touching past entries ---

test('a refund after the sale is recorded adds new rows and leaves the original sale and commission untouched', async () => {
  const so = await placeAndDeliver({ seller: sellerB, sellerToken: tokens.bOwner, listing: listingB });
  const before = await LedgerEntry.find({ sellerOrder: so._id }).lean();
  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  const rid = created.body.returnRequest._id;
  await sellerAuth(request(app).post(`/api/seller/returns/${rid}/respond`), sellerB, tokens.bOwner).send({ accept: true }).expect(200);
  await sellerAuth(request(app).post(`/api/seller/returns/${rid}/received`), sellerB, tokens.bOwner).send({}).expect(200);
  await freshStepUp(ownerUser._id);
  await adminRefund(rid, { payer: 'customer', shippingCents: 45000, method: 'cash', reference: 'CASH-1' }).expect(200);

  const after = await LedgerEntry.find({ sellerOrder: so._id, type: { $in: ['sale', 'commission'] } }).lean();
  assert.deepEqual(
    after.map((e) => [e.type, e.amountCents, e.status]).sort(),
    before.map((e) => [e.type, e.amountCents, e.status]).sort(),
    'past sale and commission rows are never edited'
  );

  const refundRows = await LedgerEntry.find({ sellerOrder: so._id, type: { $regex: /^return_/ } }).lean();
  const net = refundRows.reduce((s, e) => s + e.amountCents, 0);
  // Customer paid the 450 return shipping, so the seller's side is: sale back (−200000), commission back (+10000).
  assert.equal(net, -190000);
  assert.ok(refundRows.every((e) => e.status === 'payable'), 'refund rows are payable immediately and net into the next payout');
  const customerRefund = (await ReturnRequest.findById(rid).lean()).resolution.customerRefundCents;
  assert.equal(customerRefund, 200000 - 45000);
});

test('customer shipping cannot exceed the refund amount', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 1 });
  const created = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  const rid = created.body.returnRequest._id;
  await sellerAuth(request(app).post(`/api/seller/returns/${rid}/respond`), sellerA, tokens.aOwner).send({ accept: true }).expect(200);
  await sellerAuth(request(app).post(`/api/seller/returns/${rid}/received`), sellerA, tokens.aOwner).send({}).expect(200);
  await freshStepUp(ownerUser._id);
  const res = await adminRefund(rid, { payer: 'customer', shippingCents: 999999, method: 'cash', reference: 'X' });
  assert.equal(res.status, 400);
});

test('the customer sees per-line returnability on their order and their own returns only', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const parent = await Order.findById(so.order).lean();
  const order = await request(app).get(`/api/customer/orders/${parent.orderNumber}`).set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(order.status, 200);
  const line = order.body.sellerOrders[0].returnability[0];
  assert.equal(line.canRequest, true);
  assert.equal(line.remainingQty, 2);

  const list = await request(app).get('/api/customer/returns').set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.returns));
});

test('the return reason must be one of the allowed values', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const res = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }], reason: 'bored' });
  assert.equal(res.status, 400);
});

test('the return window and rules come from the category, not the order', async () => {
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 1 });
  await Category.updateOne({ _id: returnable._id }, { $set: { 'returnPolicy.windowDays': 1 } });
  await SellerOrder.updateOne({ _id: so._id }, { $set: { deliveredAt: new Date(Date.now() - 2 * DAY) } });
  const res = await requestReturn({ sellerOrderId: so._id, lines: [{ itemId: so.items[0]._id.toString(), qty: 1 }] });
  assert.equal(res.status, 409);
  await Category.updateOne({ _id: returnable._id }, { $set: { 'returnPolicy.windowDays': 7 } });
});

test('photos are re-encoded server-side, only real images are accepted, and only the owning parties can view them', async () => {
  const sharp = require('sharp');
  const jpeg = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888888' } }).jpeg().toBuffer();
  const so = await placeAndDeliver({ seller: sellerA, sellerToken: tokens.aOwner, listing: listingA, qty: 2 });
  const itemId = so.items[0]._id.toString();

  const fake = await request(app)
    .post('/api/customer/returns')
    .set('Authorization', `Bearer ${tokens.customer}`)
    .field('sellerOrderId', so._id.toString())
    .field('reason', 'damaged')
    .field('lines', JSON.stringify([{ itemId, qty: 1 }]))
    .attach('photos', Buffer.from('not an image at all'), 'evil.jpg');
  assert.equal(fake.status, 400);

  const created = await request(app)
    .post('/api/customer/returns')
    .set('Authorization', `Bearer ${tokens.customer}`)
    .field('sellerOrderId', so._id.toString())
    .field('reason', 'damaged')
    .field('lines', JSON.stringify([{ itemId, qty: 1 }]))
    .attach('photos', jpeg, 'photo.jpg');
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const rid = created.body.returnRequest._id;
  assert.equal(created.body.returnRequest.photos.length, 1);

  const customerView = await request(app).get(`/api/customer/returns/${rid}/photos/0`).set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(customerView.status, 200);
  assert.match(customerView.headers['content-type'], /image\/jpeg/);

  const sellerView = await sellerAuth(request(app).get(`/api/seller/returns/${rid}/photos/0`), sellerA, tokens.aOwner);
  assert.equal(sellerView.status, 200);

  const otherSeller = await sellerAuth(request(app).get(`/api/seller/returns/${rid}/photos/0`), sellerB, tokens.bOwner);
  assert.equal(otherSeller.status, 404);

  const adminView = await request(app).get(`/api/admin/returns/${rid}/photos/0`).set('Authorization', `Bearer ${tokens.staff}`);
  assert.equal(adminView.status, 200);

  const missing = await request(app).get(`/api/customer/returns/${rid}/photos/3`).set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(missing.status, 404);
});
