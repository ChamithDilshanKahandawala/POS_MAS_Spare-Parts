// Milestone 7 — ledger, commission, COD reconciliation, payouts. Each
// tests/*.test.js file is its own process against a shared in-memory
// replica set (see helpers.js) — this sets up its own sellers/listings/
// customers rather than relying on any other milestone's fixtures.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, User, Category, Listing, PlatformSettings, SellerOrder,
  LedgerEntry, PayoutRun, Payout, CourierColumnMapping, AuditLog, mongoose,
} = require('./helpers');
const { postDeliveryLedgerEntries } = require('../services/ledger');
const { runSweep: runLedgerMaturitySweep } = require('../services/ledgerMaturity');
const { processRemittanceUpload } = require('../services/remittance');
const { isoWeekKey, generateDraftRun } = require('../services/payoutRuns');

const name = (en) => ({ en, si: '', ta: '' });
const idemKey = () => `idem7-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const trackingKey = () => `TX7-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

let category;
let sellerA, sellerB, sellerUnverified, sellerInternal;
let tokens = {};
let addrCustomer;
let listingA, listingB, listingUnverified, listingInternal;
let platformOwnerUser;

// Places a real order for one listing/seller and drives it all the way
// to 'delivered' through the real HTTP transition routes (confirm ->
// pack -> ship -> deliver) — exactly what a seller clicking through the
// console would do. Returns the sellerOrder doc (fresh from the DB,
// post-delivery, so ledgerPostedAt/deliveredAt are populated).
async function placeAndDeliver({ sellerToken, sellerId, customerToken, listingId, qty = 1 }) {
  const placed = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${customerToken}`).send({
    addressId: addrCustomer,
    items: [{ listingId: listingId.toString(), qty }],
    idempotencyKey: idemKey(),
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const so = placed.body.sellerOrders.find((x) => x.seller === sellerId.toString() || x.seller?._id === sellerId.toString());
  const soId = so._id;

  const auth = (req) => req.set('Authorization', `Bearer ${sellerToken}`).set('X-Seller-Id', sellerId.toString());
  assert.equal((await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'confirm' })).status, 200);
  assert.equal((await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'pack' })).status, 200);
  assert.equal((await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: trackingKey() })).status, 200);
  const deliver = await auth(request(app).post(`/api/seller/orders/${soId}/transition`)).send({ action: 'deliver' });
  assert.equal(deliver.status, 200);

  return SellerOrder.findById(soId).lean();
}

before(async () => {
  await wipeDatabase();

  platformOwnerUser = await createUser({ name: 'Platform Owner', email: 'owner7@test.apexora', platformRole: 'platform_owner' });
  const aOwnerUser = await createUser({ name: 'A Owner', email: 'a-owner7@test.apexora' });
  const aStaffUser = await createUser({ name: 'A Staff', email: 'a-staff7@test.apexora' });
  const bOwnerUser = await createUser({ name: 'B Owner', email: 'b-owner7@test.apexora' });
  const uOwnerUser = await createUser({ name: 'Unverified Owner', email: 'u-owner7@test.apexora' });
  const iOwnerUser = await createUser({ name: 'Internal Owner', email: 'i-owner7@test.apexora' });
  const customer = await createUser({ name: 'Customer', email: 'customer7@test.apexora' });

  // 5% default commission; sellerB below overrides it per-seller.
  category = await Category.create({ name: name('Finance Parts'), slug: 'finance-parts-m7', depth: 0, active: true, commissionRateBps: 500 });

  sellerA = await Seller.create({
    name: 'Seller A', legalName: 'Seller A Ltd', brNumber: 'BR-A7', status: 'active', slug: 'seller-a-m7',
    bankAccount: { bankName: 'Sampath', branch: 'Colombo', accountName: 'Seller A Ltd', accountNumber: '1112223334', last4: '3334', status: 'verified', verifiedAt: new Date() },
  });
  sellerB = await Seller.create({
    name: 'Seller B', legalName: 'Seller B Ltd', brNumber: 'BR-B7', status: 'active', slug: 'seller-b-m7',
    commissionOverridePct: 2.5, // 250 bps, overrides the category's 500
    bankAccount: { bankName: 'HNB', branch: 'Kandy', accountName: 'Seller B Ltd', accountNumber: '2223334445', last4: '4445', status: 'verified', verifiedAt: new Date() },
  });
  sellerUnverified = await Seller.create({
    name: 'Seller Unverified', legalName: 'Unverified Ltd', brNumber: 'BR-U7', status: 'active', slug: 'seller-u-m7',
    // bankAccount left at its schema default — status: 'none'.
  });
  sellerInternal = await Seller.create({
    name: 'Seller Internal', legalName: 'Internal Ltd', brNumber: 'BR-I7', status: 'active', slug: 'seller-i-m7',
    settlementMode: 'internal',
  });

  await SellerMember.create({ user: aOwnerUser._id, seller: sellerA._id, role: 'seller_owner' });
  await SellerMember.create({ user: aStaffUser._id, seller: sellerA._id, role: 'seller_staff' });
  await SellerMember.create({ user: bOwnerUser._id, seller: sellerB._id, role: 'seller_owner' });
  await SellerMember.create({ user: uOwnerUser._id, seller: sellerUnverified._id, role: 'seller_owner' });
  await SellerMember.create({ user: iOwnerUser._id, seller: sellerInternal._id, role: 'seller_owner' });

  tokens.platformOwner = (await loginFlow('owner7@test.apexora')).accessToken;
  tokens.aOwner = (await loginFlow('a-owner7@test.apexora')).accessToken;
  tokens.aStaff = (await loginFlow('a-staff7@test.apexora')).accessToken;
  tokens.bOwner = (await loginFlow('b-owner7@test.apexora')).accessToken;
  tokens.uOwner = (await loginFlow('u-owner7@test.apexora')).accessToken;
  tokens.iOwner = (await loginFlow('i-owner7@test.apexora')).accessToken;
  tokens.customer = (await loginFlow('customer7@test.apexora')).accessToken;

  const c = await User.findById(customer._id);
  c.addresses.push({ line1: '1 Finance Lane', city: 'Colombo', district: 'Colombo', phone: '0770000000', isDefault: true });
  await c.save();
  addrCustomer = c.addresses[0]._id.toString();

  await PlatformSettings.create({
    _id: 'platform-settings', onlineOrderingEnabled: true,
    payoutHoldDays: 7, minimumPayoutCents: 1000, refusedParcelChargedTo: 'platform',
  });

  listingA = await Listing.create({ seller: sellerA._id, categoryId: category._id, status: 'published', stock: 50, priceCents: 100000, weightGrams: 500, title: name('Item A'), publishedAt: new Date() });
  listingB = await Listing.create({ seller: sellerB._id, categoryId: category._id, status: 'published', stock: 50, priceCents: 200000, weightGrams: 500, title: name('Item B'), publishedAt: new Date() });
  listingUnverified = await Listing.create({ seller: sellerUnverified._id, categoryId: category._id, status: 'published', stock: 50, priceCents: 50000, weightGrams: 500, title: name('Item U'), publishedAt: new Date() });
  listingInternal = await Listing.create({ seller: sellerInternal._id, categoryId: category._id, status: 'published', stock: 50, priceCents: 60000, weightGrams: 500, title: name('Item I'), publishedAt: new Date() });
});

after(async () => {
  await mongoose.disconnect();
});

// --- Part A.2: commission computation, rounding, idempotency ---

test('delivering an order posts one sale + one commission entry, correctly rounded, using the snapshot (incl. seller-override) rate', async () => {
  const soA = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  const entriesA = await LedgerEntry.find({ sellerOrder: soA._id }).lean();
  assert.equal(entriesA.length, 2);
  const saleA = entriesA.find((e) => e.type === 'sale');
  const commissionA = entriesA.find((e) => e.type === 'commission');
  assert.equal(saleA.amountCents, 100000);
  assert.equal(commissionA.amountCents, -5000); // 100000 * 500bps / 10000 = 5000, no rounding needed
  assert.equal(saleA.status, 'on_hold');
  assert.equal(commissionA.status, 'on_hold');

  // Seller B: commissionOverridePct 2.5% (250 bps) wins over the
  // category's 500 — proves the snapshot rate, not the category's
  // current rate, is what gets used.
  const soB = await placeAndDeliver({ sellerToken: tokens.bOwner, sellerId: sellerB._id, customerToken: tokens.customer, listingId: listingB._id });
  const entriesB = await LedgerEntry.find({ sellerOrder: soB._id }).lean();
  const commissionB = entriesB.find((e) => e.type === 'commission');
  assert.equal(commissionB.amountCents, -5000); // 200000 * 250bps / 10000 = 5000
});

test('delivered twice / retried → exactly one sale + one commission entry (the admin move-on path is idempotent with the seller path)', async () => {
  const so = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  assert.equal(await LedgerEntry.countDocuments({ sellerOrder: so._id }), 2);

  // Calling the posting function again directly (simulating a retried
  // request, or the admin move-on path firing on an order the seller
  // path already delivered) must be a pure no-op — the atomic claim on
  // ledgerPostedAt is what prevents this, not a lucky race.
  await postDeliveryLedgerEntries(so._id);
  await postDeliveryLedgerEntries(so._id);
  assert.equal(await LedgerEntry.countDocuments({ sellerOrder: so._id }), 2);

  // Two concurrent calls, same guarantee.
  const so2 = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  await Promise.all([postDeliveryLedgerEntries(so2._id), postDeliveryLedgerEntries(so2._id)]);
  assert.equal(await LedgerEntry.countDocuments({ sellerOrder: so2._id }), 2);
});

// --- Part B.3: on_hold -> payable gating ---

test('a sale/commission entry never becomes payable before availableAt has passed', async () => {
  await PlatformSettings.updateOne({ _id: 'platform-settings' }, { $set: { payoutHoldDays: 7 } });
  const so = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  await SellerOrder.updateOne({ _id: so._id }, { $set: { codMatched: true, codMatchedAt: new Date() } }); // COD side already fine — only the hold is blocking

  await runLedgerMaturitySweep();
  const stillOnHold = await LedgerEntry.find({ sellerOrder: so._id }).lean();
  assert.ok(stillOnHold.every((e) => e.status === 'on_hold'), 'availableAt is 7 days out — nothing should have matured yet');
});

test('a sale/commission entry never becomes payable until the COD is matched, even after availableAt passes', async () => {
  const so = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  // Fast-forward: availableAt already in the past, COD still unmatched.
  await LedgerEntry.updateMany({ sellerOrder: so._id }, { $set: { availableAt: new Date(Date.now() - 1000) } });

  await runLedgerMaturitySweep();
  let entries = await LedgerEntry.find({ sellerOrder: so._id }).lean();
  assert.ok(entries.every((e) => e.status === 'on_hold'), 'COD not yet matched — must stay on_hold');

  await SellerOrder.updateOne({ _id: so._id }, { $set: { codMatched: true, codMatchedAt: new Date() } });
  await runLedgerMaturitySweep();
  entries = await LedgerEntry.find({ sellerOrder: so._id }).lean();
  assert.ok(entries.every((e) => e.status === 'payable'), 'both availableAt passed and COD matched — must now be payable');
});

// --- Part A.3: refused parcel charge ---

test('a refused/returned parcel charges the seller only when refusedParcelChargedTo is "seller"', async () => {
  await PlatformSettings.updateOne({ _id: 'platform-settings' }, { $set: { refusedParcelChargedTo: 'platform' } });
  const placed1 = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer}`).send({
    addressId: addrCustomer, items: [{ listingId: listingA._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  const so1Id = placed1.body.sellerOrders[0]._id;
  const authA = (req) => req.set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  await authA(request(app).post(`/api/seller/orders/${so1Id}/transition`)).send({ action: 'confirm' });
  await authA(request(app).post(`/api/seller/orders/${so1Id}/transition`)).send({ action: 'pack' });
  await authA(request(app).post(`/api/seller/orders/${so1Id}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: trackingKey() });
  await authA(request(app).post(`/api/seller/orders/${so1Id}/transition`)).send({ action: 'fail', reason: 'customer unavailable' });
  await authA(request(app).post(`/api/seller/orders/${so1Id}/transition`)).send({ action: 'return', reason: 'refused' });
  assert.equal(await LedgerEntry.countDocuments({ sellerOrder: so1Id, type: 'refused_parcel_charge' }), 0);

  await PlatformSettings.updateOne({ _id: 'platform-settings' }, { $set: { refusedParcelChargedTo: 'seller' } });
  const placed2 = await request(app).post('/api/customer/orders').set('Authorization', `Bearer ${tokens.customer}`).send({
    addressId: addrCustomer, items: [{ listingId: listingA._id.toString(), qty: 1 }], idempotencyKey: idemKey(),
  });
  const so2Id = placed2.body.sellerOrders[0]._id;
  assert.equal((await authA(request(app).post(`/api/seller/orders/${so2Id}/transition`)).send({ action: 'confirm' })).status, 200);
  assert.equal((await authA(request(app).post(`/api/seller/orders/${so2Id}/transition`)).send({ action: 'pack' })).status, 200);
  assert.equal((await authA(request(app).post(`/api/seller/orders/${so2Id}/transition`)).send({ action: 'ship', courier: 'Transexpress', trackingNumber: trackingKey() })).status, 200);
  assert.equal((await authA(request(app).post(`/api/seller/orders/${so2Id}/transition`)).send({ action: 'fail', reason: 'customer unavailable' })).status, 200);
  const returnRes = await authA(request(app).post(`/api/seller/orders/${so2Id}/transition`)).send({ action: 'return', reason: 'refused' });
  assert.equal(returnRes.status, 200, JSON.stringify(returnRes.body));

  const charge = await LedgerEntry.findOne({ sellerOrder: so2Id, type: 'refused_parcel_charge' }).lean();
  const so2 = await SellerOrder.findById(so2Id).lean();
  assert.ok(charge, `refusedParcelCostCents=${so2.refusedParcelCostCents}, deliveryFeeCents=${so2.deliveryFeeCents}, settings refusedParcelChargedTo=${(await PlatformSettings.findById('platform-settings')).refusedParcelChargedTo}`);
  assert.equal(charge.amountCents, -so2.refusedParcelCostCents);
  assert.equal(charge.status, 'payable'); // no COD/hold to wait on — the parcel never reached the customer
  await PlatformSettings.updateOne({ _id: 'platform-settings' }, { $set: { refusedParcelChargedTo: 'platform' } });
});

// --- Part A.4: adjustments ---

test('an owner adjustment is audited and immediately payable', async () => {
  const res = await request(app).post(`/api/admin/finance/sellers/${sellerA._id}/adjustments`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ amountCents: 2000, reason: 'Goodwill credit' });
  assert.equal(res.status, 403); // no fresh step-up yet

  const stepUp = await request(app).post('/api/admin/step-up').set('Authorization', `Bearer ${tokens.platformOwner}`).send({ password: 'TestPass123!' });
  assert.equal(stepUp.status, 200);
  const verify = await request(app).post('/api/admin/step-up/verify').set('Authorization', `Bearer ${tokens.platformOwner}`).send({ code: stepUp.body.debugOtpCode });
  assert.equal(verify.status, 200);

  const adj = await request(app).post(`/api/admin/finance/sellers/${sellerA._id}/adjustments`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ amountCents: 2000, reason: 'Goodwill credit' });
  assert.equal(adj.status, 201);
  assert.equal(adj.body.entry.status, 'payable');
  assert.equal(adj.body.entry.amountCents, 2000);

  const logged = await AuditLog.findOne({ action: 'finance.adjustment.create', targetId: sellerA._id.toString() }).lean();
  assert.ok(logged);
  assert.match(logged.summary, /Goodwill credit/);
});

// --- Part B.2/B.4: remittance upload ---

test('remittance upload: matched/short/over/unknown_tracking classification, and re-uploading the same file does not double-count', async () => {
  await CourierColumnMapping.create({
    courierName: 'TestCourier',
    trackingNumberColumn: 'Tracking', codAmountColumn: 'Amount', remittanceDateColumn: 'Date', referenceColumn: 'Ref',
  });

  const soMatched = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  const soShort = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  const soOver = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });

  const csv = [
    'Tracking,Amount,Date,Ref',
    `${soMatched.trackingNumber},${(soMatched.codAmountCents / 100).toFixed(2)},2026-10-20,REF-1`,
    `${soShort.trackingNumber},${((soShort.codAmountCents - 500) / 100).toFixed(2)},2026-10-20,REF-2`,
    `${soOver.trackingNumber},${((soOver.codAmountCents + 500) / 100).toFixed(2)},2026-10-20,REF-3`,
    'TX-DOES-NOT-EXIST,999.00,2026-10-20,REF-4',
  ].join('\n');

  const uploaded = await processRemittanceUpload({ courierName: 'TestCourier', fileText: csv, uploadedBy: platformOwnerUser._id });
  assert.equal(uploaded.summary.matched, 1);
  assert.equal(uploaded.summary.short, 1);
  assert.equal(uploaded.summary.over, 1);
  assert.equal(uploaded.summary.unknownTracking, 1);
  assert.equal(uploaded.summary.duplicate, 0);

  assert.equal((await SellerOrder.findById(soMatched._id).lean()).codMatched, true);
  assert.equal((await SellerOrder.findById(soShort._id).lean()).codMatched, false);
  assert.equal((await SellerOrder.findById(soOver._id).lean()).codMatched, false);

  // Re-upload the exact same file — nothing should double count.
  const reuploaded = await processRemittanceUpload({ courierName: 'TestCourier', fileText: csv, uploadedBy: platformOwnerUser._id });
  assert.equal(reuploaded.summary.duplicate, 4);
  assert.equal(reuploaded.summary.matched, 0);
  assert.equal(reuploaded.summary.short, 0);
  assert.equal(reuploaded.summary.over, 0);
  assert.equal(reuploaded.summary.unknownTracking, 0);
});

test('the admin remittance upload HTTP route accepts a real multipart CSV and requires a saved column mapping', async () => {
  const noMapping = await request(app)
    .post('/api/admin/finance/remittances/upload')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .field('courierName', 'NoMappingCourier')
    .attach('file', Buffer.from('Tracking,Amount,Date,Ref\nX,1,2026-01-01,R\n'), 'remit.csv');
  assert.equal(noMapping.status, 400);

  await request(app).put('/api/admin/finance/remittances/mapping/HttpCourier')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ trackingNumberColumn: 'Tracking', codAmountColumn: 'Amount', remittanceDateColumn: 'Date', referenceColumn: 'Ref' });

  const soHttp = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  const csv = `Tracking,Amount,Date,Ref\n${soHttp.trackingNumber},${(soHttp.codAmountCents / 100).toFixed(2)},2026-10-20,REF-HTTP\n`;
  const uploaded = await request(app)
    .post('/api/admin/finance/remittances/upload')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .field('courierName', 'HttpCourier')
    .attach('file', Buffer.from(csv), 'remit.csv');
  assert.equal(uploaded.status, 200);
  assert.equal(uploaded.body.summary.matched, 1);
});

// --- Part C: payout runs ---

test('payout run generation matches a hand-written table to the cent: blocked (unverified), real payout, and internal settlement', async () => {
  await PlatformSettings.updateOne({ _id: 'platform-settings' }, { $set: { minimumPayoutCents: 1000 } });

  // Clean slate for the three sellers this hand-written table is about —
  // earlier tests in this file already left some 'payable'/'on_hold'
  // entries on sellerA from exercising other behaviors, which would
  // otherwise inflate the totals below past what the table says.
  await LedgerEntry.deleteMany({ seller: { $in: [sellerA._id, sellerUnverified._id, sellerInternal._id] } });

  const soA = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  const soU = await placeAndDeliver({ sellerToken: tokens.uOwner, sellerId: sellerUnverified._id, customerToken: tokens.customer, listingId: listingUnverified._id });
  const soI = await placeAndDeliver({ sellerToken: tokens.iOwner, sellerId: sellerInternal._id, customerToken: tokens.customer, listingId: listingInternal._id });

  // Make every one of this test's entries immediately payable: COD
  // matched + availableAt already past.
  for (const so of [soA, soU, soI]) {
    await SellerOrder.updateOne({ _id: so._id }, { $set: { codMatched: true, codMatchedAt: new Date() } });
    await LedgerEntry.updateMany({ sellerOrder: so._id }, { $set: { availableAt: new Date(Date.now() - 1000) } });
  }
  await runLedgerMaturitySweep();

  // Hand-written expected table (integer cents):
  //   Seller A: sale +100000, commission -5000           -> net 95000, bank-verified payout mode -> in_payout
  //   Seller U: sale +50000,  commission -2500            -> net 47500, NO verified bank           -> blocked, stays payable
  //   Seller I: sale +60000,  commission -3000            -> net 57000, settlementMode internal     -> settled_internally, entries -> paid
  const run = await generateDraftRun({ createdBy: platformOwnerUser._id });
  const payouts = await Payout.find({ payoutRun: run._id }).lean();
  const byS = (id) => payouts.find((p) => String(p.seller) === String(id));

  const pA = byS(sellerA._id);
  assert.equal(pA.status, 'in_payout');
  assert.equal(pA.grossSalesCents, 100000);
  assert.equal(pA.commissionCents, -5000);
  assert.equal(pA.netCents, 95000);

  const pU = byS(sellerUnverified._id);
  assert.equal(pU.status, 'blocked');
  assert.equal(pU.netCents, 47500);
  assert.equal(pU.entries.length, 0);
  // Part C.2 — entries stay exactly as 'payable', never claimed.
  const uEntries = await LedgerEntry.find({ sellerOrder: soU._id }).lean();
  assert.ok(uEntries.every((e) => e.status === 'payable'));

  const pI = byS(sellerInternal._id);
  assert.equal(pI.status, 'settled_internally');
  assert.equal(pI.netCents, 57000);
  const iEntries = await LedgerEntry.find({ sellerOrder: soI._id }).lean();
  assert.ok(iEntries.every((e) => e.status === 'paid'));
  assert.equal(await LedgerEntry.countDocuments({ seller: sellerInternal._id, type: 'payout' }), 1);

  global.__m7Run = run; // reused by the approve/export/mark-paid tests below
  global.__m7SellerAOrder = soA;
});

test('generating the same week\'s run twice gives one run', async () => {
  const before = await PayoutRun.countDocuments({ weekKey: global.__m7Run.weekKey });
  const again = await generateDraftRun();
  assert.equal(String(again._id), String(global.__m7Run._id));
  const after2 = await PayoutRun.countDocuments({ weekKey: global.__m7Run.weekKey });
  assert.equal(after2, before);
});

test('parallel payout generation → one run, no entry in two payouts', async () => {
  // A brand-new week's worth of data so this test doesn't collide with
  // the run already created above for the current real week.
  const fakeNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 400); // ~13 months out — a different ISO week for sure
  const soRace = await placeAndDeliver({ sellerToken: tokens.aOwner, sellerId: sellerA._id, customerToken: tokens.customer, listingId: listingA._id });
  await SellerOrder.updateOne({ _id: soRace._id }, { $set: { codMatched: true, codMatchedAt: new Date() } });
  await LedgerEntry.updateMany({ sellerOrder: soRace._id }, { $set: { availableAt: new Date(Date.now() - 1000) } });
  await runLedgerMaturitySweep();

  const [r1, r2] = await Promise.all([
    generateDraftRun({ now: fakeNow }),
    generateDraftRun({ now: fakeNow }),
  ]);
  assert.equal(String(r1._id), String(r2._id));
  assert.equal(await PayoutRun.countDocuments({ weekKey: isoWeekKey(fakeNow) }), 1);

  const entries = await LedgerEntry.find({ sellerOrder: soRace._id }).lean();
  const payoutIdsUsed = new Set(entries.map((e) => String(e.payout)));
  assert.equal(payoutIdsUsed.size, 1, 'every entry from this order must point at exactly one payout');
});

test('approving a run locks it; bank export requires step-up, is audited, and only there is a full account number ever returned', async () => {
  const run = global.__m7Run;

  // An earlier test (the adjustment one) left this owner's step-up fresh
  // (the 5-minute window may not have lapsed yet depending on suite
  // speed) — force it stale so "no fresh step-up -> 403" is actually
  // being tested here, deterministically, rather than depending on
  // timing between unrelated tests.
  await User.updateOne({ _id: platformOwnerUser._id }, { $set: { stepUpVerifiedAt: null } });
  const exportNoStepUp = await request(app).get(`/api/admin/finance/payout-runs/${run._id}/export.csv`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(exportNoStepUp.status, 403);

  const exportBeforeApproval = await request(app).get(`/api/admin/finance/payout-runs/${run._id}/export.csv`).set('Authorization', `Bearer ${tokens.aOwner}`); // wrong user entirely, just proving platform-role gate
  assert.equal(exportBeforeApproval.status, 403);

  const approveRes = await request(app).post(`/api/admin/finance/payout-runs/${run._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  // Step-up from the adjustments test may have expired (5-minute window)
  // by now depending on suite speed — re-establish it to be safe.
  if (approveRes.status === 403) {
    const su = await request(app).post('/api/admin/step-up').set('Authorization', `Bearer ${tokens.platformOwner}`).send({ password: 'TestPass123!' });
    await request(app).post('/api/admin/step-up/verify').set('Authorization', `Bearer ${tokens.platformOwner}`).send({ code: su.body.debugOtpCode });
  }
  const approved = await request(app).post(`/api/admin/finance/payout-runs/${run._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.run.status, 'approved');

  const secondApprove = await request(app).post(`/api/admin/finance/payout-runs/${run._id}/approve`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(secondApprove.status, 409);

  const removeAfterApproval = await request(app).delete(`/api/admin/finance/payout-runs/${run._id}/sellers/${sellerA._id}`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(removeAfterApproval.status, 409);

  const csvRes = await request(app).get(`/api/admin/finance/payout-runs/${run._id}/export.csv`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.text, /1112223334/); // the FULL account number, only ever here
  assert.doesNotMatch(csvRes.text, /Seller Unverified/); // blocked — never exported
  assert.doesNotMatch(csvRes.text, /Seller Internal/); // settled internally — never a bank transfer

  // Confirmed nowhere else ever returns the full number — the seller
  // balances table and the run review screen only ever see last4.
  const reviewRes = await request(app).get(`/api/admin/finance/payout-runs/${run._id}`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.doesNotMatch(JSON.stringify(reviewRes.body), /1112223334/);

  const logged = await AuditLog.findOne({ action: 'finance.payout_run.export_bank_csv', targetId: run._id.toString() }).lean();
  assert.ok(logged);

  global.__m7Run = await PayoutRun.findById(run._id).lean();
});

test('mark paid moves entries to paid and creates a payout entry; mark failed moves entries back to payable and creates a payout_reversal entry', async () => {
  const run = global.__m7Run;
  const payoutA = await Payout.findOne({ payoutRun: run._id, seller: sellerA._id }).lean();

  const paidRes = await request(app).post(`/api/admin/finance/payouts/${payoutA._id}/mark-paid`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ bankReference: 'BANKREF-001' });
  assert.equal(paidRes.status, 200);
  assert.equal(paidRes.body.payout.status, 'paid');

  const entriesAfterPaid = await LedgerEntry.find({ _id: { $in: payoutA.entries } }).lean();
  assert.ok(entriesAfterPaid.every((e) => e.status === 'paid'));
  const payoutEntry = await LedgerEntry.findOne({ payout: payoutA._id, type: 'payout' }).lean();
  assert.ok(payoutEntry);
  assert.equal(payoutEntry.amountCents, -payoutA.netCents);

  // Mark-failed on a different, separately-generated payout (a fresh
  // seller/order so it doesn't collide with the now-paid one above).
  const soFail = await placeAndDeliver({ sellerToken: tokens.bOwner, sellerId: sellerB._id, customerToken: tokens.customer, listingId: listingB._id });
  await SellerOrder.updateOne({ _id: soFail._id }, { $set: { codMatched: true, codMatchedAt: new Date() } });
  await LedgerEntry.updateMany({ sellerOrder: soFail._id }, { $set: { availableAt: new Date(Date.now() - 1000) } });
  await runLedgerMaturitySweep();
  const failRun = await generateDraftRun({ now: new Date(Date.now() + 1000 * 60 * 60 * 24 * 800) });
  const payoutB = await Payout.findOne({ payoutRun: failRun._id, seller: sellerB._id }).lean();

  const failedRes = await request(app).post(`/api/admin/finance/payouts/${payoutB._id}/mark-failed`)
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ reason: 'Bank rejected the transfer' });
  assert.equal(failedRes.status, 200);
  assert.equal(failedRes.body.payout.status, 'failed');

  const entriesAfterFail = await LedgerEntry.find({ _id: { $in: payoutB.entries } }).lean();
  assert.ok(entriesAfterFail.every((e) => e.status === 'payable' && !e.payout));
  const reversalEntry = await LedgerEntry.findOne({ payout: payoutB._id, type: 'payout_reversal' }).lean();
  assert.ok(reversalEntry);
  assert.equal(reversalEntry.amountCents, payoutB.netCents);
});

// --- Isolation / access control ---

test('seller A cannot see seller B\'s ledger/payouts (404); seller staff get 403 on every Finance route; customers get 403; a view-as token can still read', async () => {
  const soB = await LedgerEntry.findOne({ seller: sellerB._id }).lean();

  // Isolation is enforced by scoping every query to req.sellerId — there
  // is no "fetch by arbitrary entry id" route at all, so the real test
  // here is that seller A's OWN ledger view never contains seller B's
  // entries, and the per-order breakdown route 404s for an order that
  // belongs to seller B.
  const aLedger = await request(app).get('/api/seller/finance/ledger').set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(aLedger.status, 200);
  assert.ok(aLedger.body.entries.every((e) => String(e.seller) !== String(sellerB._id)));

  const bOrder = await SellerOrder.findOne({ seller: sellerB._id }).lean();
  const crossOrder = await request(app).get(`/api/seller/finance/orders/${bOrder._id}`).set('Authorization', `Bearer ${tokens.aOwner}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(crossOrder.status, 404);

  const staffBalances = await request(app).get('/api/seller/finance/balances').set('Authorization', `Bearer ${tokens.aStaff}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(staffBalances.status, 403);
  const staffLedger = await request(app).get('/api/seller/finance/ledger').set('Authorization', `Bearer ${tokens.aStaff}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(staffLedger.status, 403);
  const staffPayouts = await request(app).get('/api/seller/finance/payouts').set('Authorization', `Bearer ${tokens.aStaff}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(staffPayouts.status, 403);

  const customerFinance = await request(app).get('/api/admin/finance/overview').set('Authorization', `Bearer ${tokens.customer}`);
  assert.equal(customerFinance.status, 403);
  const customerSellerFinance = await request(app).get('/api/seller/finance/balances').set('Authorization', `Bearer ${tokens.customer}`).set('X-Seller-Id', sellerA._id.toString());
  assert.equal(customerSellerFinance.status, 404); // no membership at all — same as every other seller route

  const { signViewAsToken } = require('../services/tokens');
  const viewAsToken = signViewAsToken(platformOwnerUser, sellerA._id);
  const viewAsRead = await request(app).get('/api/seller/finance/balances').set('Authorization', `Bearer ${viewAsToken}`);
  assert.equal(viewAsRead.status, 200);

  void soB;
});

test('ledger entries can never be edited or deleted through any route', async () => {
  const entry = await LedgerEntry.findOne({ seller: sellerA._id }).lean();
  // There is no PATCH/PUT/DELETE route for a ledger entry anywhere in
  // the app — this asserts that directly rather than trying every
  // conceivable guessed path, since the real guarantee is "the route
  // doesn't exist", not "the route exists and rejects".
  const patchAttempt = await request(app).patch(`/api/admin/finance/ledger-entries/${entry._id}`).set('Authorization', `Bearer ${tokens.platformOwner}`).send({ amountCents: 1 });
  assert.equal(patchAttempt.status, 404);
  const deleteAttempt = await request(app).delete(`/api/admin/finance/ledger-entries/${entry._id}`).set('Authorization', `Bearer ${tokens.platformOwner}`);
  assert.equal(deleteAttempt.status, 404);

  const unchanged = await LedgerEntry.findById(entry._id).lean();
  assert.deepEqual(unchanged.amountCents, entry.amountCents);
});

// --- Follow-up: payoutHoldDays safety ---

test('payoutHoldDays can\'t be set below the longest return window of an active, returnable category, and the reason is shown', async () => {
  const longWindowCategory = await Category.create({
    name: name('Long Return Window'), slug: 'long-return-window-m7', depth: 0, active: true,
    returnPolicy: { returnable: true, windowDays: 20 },
  });

  const tooShort = await request(app).patch('/api/admin/settings')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ payoutHoldDays: 5 });
  assert.equal(tooShort.status, 400);
  assert.match(tooShort.body.message, /20/);
  assert.match(tooShort.body.message, /Long Return Window/);

  // Nothing was changed by the rejected save.
  const unchanged = await PlatformSettings.findById('platform-settings').lean();
  assert.notEqual(unchanged.payoutHoldDays, 5);

  const longEnough = await request(app).patch('/api/admin/settings')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ payoutHoldDays: 20 });
  assert.equal(longEnough.status, 200);
  assert.equal(longEnough.body.settings.payoutHoldDays, 20);

  await Category.deleteOne({ _id: longWindowCategory._id });
});

test('an inactive category\'s return window never blocks a shorter payoutHoldDays, and neither does a non-returnable one', async () => {
  const inactiveLongWindow = await Category.create({
    name: name('Inactive Long Window'), slug: 'inactive-long-window-m7', depth: 0, active: false,
    returnPolicy: { returnable: true, windowDays: 30 },
  });
  const activeNotReturnable = await Category.create({
    name: name('Active Not Returnable'), slug: 'active-not-returnable-m7', depth: 0, active: true,
    returnPolicy: { returnable: false, windowDays: 30 },
  });

  const res = await request(app).patch('/api/admin/settings')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ payoutHoldDays: 3 });
  assert.equal(res.status, 200);
  assert.equal(res.body.settings.payoutHoldDays, 3);

  await Category.deleteMany({ _id: { $in: [inactiveLongWindow._id, activeNotReturnable._id] } });
});

test('a child category inheriting its return window from a parent still counts toward the minimum', async () => {
  const parent = await Category.create({
    name: name('Parent With Window'), slug: 'parent-with-window-m7', depth: 0, active: true,
    returnPolicy: { returnable: true, windowDays: 10 },
  });
  const child = await Category.create({
    name: name('Child Inherits Window'), slug: 'child-inherits-window-m7', depth: 1, parentId: parent._id, active: true,
    // returnPolicy left unset — inherits returnable:true, windowDays:10 from the parent.
  });

  const tooShort = await request(app).patch('/api/admin/settings')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ payoutHoldDays: 2 });
  assert.equal(tooShort.status, 400);
  assert.match(tooShort.body.message, /10/);

  const ok = await request(app).patch('/api/admin/settings')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ payoutHoldDays: 10 });
  assert.equal(ok.status, 200);

  await Category.deleteMany({ _id: { $in: [parent._id, child._id] } });
});

test('payoutHoldDays: 0 is allowed in test/development but rejected outside it', async () => {
  const allowedInTest = await request(app).patch('/api/admin/settings')
    .set('Authorization', `Bearer ${tokens.platformOwner}`)
    .send({ payoutHoldDays: 0 });
  assert.equal(allowedInTest.status, 200);
  assert.equal(allowedInTest.body.settings.payoutHoldDays, 0);

  // This test file runs in its own isolated child process (node --test
  // --test-isolation=process, one file at a time), so flipping NODE_ENV
  // for the span of a single awaited request — then restoring it — can
  // never leak into another test file's process or run concurrently with
  // anything else in this one.
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const rejected = await request(app).patch('/api/admin/settings')
      .set('Authorization', `Bearer ${tokens.platformOwner}`)
      .send({ payoutHoldDays: 0 });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.message, /development\/test/);
    const unchanged = await PlatformSettings.findById('platform-settings').lean();
    assert.equal(unchanged.payoutHoldDays, 0); // still 0 from the allowed save above — the rejected one changed nothing
  } finally {
    process.env.NODE_ENV = originalEnv;
  }

  // Leave a sane, real value behind rather than 0.
  await request(app).patch('/api/admin/settings').set('Authorization', `Bearer ${tokens.platformOwner}`).send({ payoutHoldDays: 7 });
});
