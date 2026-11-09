// Milestone 10 — Seller → Performance: daily stats rebuild and the KPI endpoint.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, createUser, loginFlow,
  Seller, SellerMember, SellerOrder, ReturnRequest, SellerDailyStats, PlatformSettings, mongoose,
} = require('./helpers');
const { rebuildSellerStats, runNightlyStats, dayKey } = require('../services/sellerStats');
const { getColomboMidnightUTC } = require('../utils/colomboDate');

const HOUR = 3600e3;
const DAY = 24 * HOUR;
let sellerA, sellerB, listingX, listingY;
let tokens = {};
let lateOrderId;
let parcelSeq = 0;

// Colombo midnight N days ago, plus some hours — never near a day boundary.
const daysAgo = (n, hours = 10) => new Date(getColomboMidnightUTC(new Date()).getTime() - n * DAY + hours * HOUR);

// Inserted straight into the collection so the test controls every timestamp.
async function insertParcel({ seller, createdAt, status, lines, shippedAt = null, deliveredAt = null }) {
  const items = lines.map(([listing, title, qty, unit]) => ({ listing, title: { en: title }, qty, unitPriceCents: unit, lineTotalCents: qty * unit }));
  parcelSeq += 1;
  const { insertedId } = await SellerOrder.collection.insertOne({
    orderNumber: `APX-PERF-${parcelSeq}-1`, seller: seller._id, createdAt, updatedAt: createdAt, status, shippedAt, deliveredAt,
    itemsTotalCents: items.reduce((s, i) => s + i.lineTotalCents, 0), items,
  });
  return insertedId;
}

before(async () => {
  await wipeDatabase();
  const ownerA = await createUser({ name: 'A Owner', email: 'a10p@test.apexora' });
  const staffA = await createUser({ name: 'A Staff', email: 'a10p-staff@test.apexora' });
  const ownerB = await createUser({ name: 'B Owner', email: 'b10p@test.apexora' });
  sellerA = await Seller.create({ name: 'Perf A', legalName: 'Perf A Ltd', brNumber: 'BR-PA', status: 'active', slug: 'perf-a' });
  sellerB = await Seller.create({ name: 'Perf B', legalName: 'Perf B Ltd', brNumber: 'BR-PB', status: 'active', slug: 'perf-b' });
  await SellerMember.create({ user: ownerA._id, seller: sellerA._id, role: 'seller_owner' });
  await SellerMember.create({ user: staffA._id, seller: sellerA._id, role: 'seller_staff' });
  await SellerMember.create({ user: ownerB._id, seller: sellerB._id, role: 'seller_owner' });
  await PlatformSettings.create({ _id: 'platform-settings', dispatchWithinHours: 48 });
  tokens.a = (await loginFlow('a10p@test.apexora')).accessToken;
  tokens.aStaff = (await loginFlow('a10p-staff@test.apexora')).accessToken;
  tokens.b = (await loginFlow('b10p@test.apexora')).accessToken;

  listingX = new mongoose.Types.ObjectId();
  listingY = new mongoose.Types.ObjectId();

  // On time: shipped 20h after the order, then delivered, then a return.
  await insertParcel({ seller: sellerA, createdAt: daysAgo(3), status: 'delivered', shippedAt: daysAgo(3, 30), deliveredAt: daysAgo(1), lines: [[listingX, 'Brake Pad', 2, 150000]] });
  // Late: shipped 72h after the order.
  lateOrderId = await insertParcel({ seller: sellerA, createdAt: daysAgo(5), status: 'shipped', shippedAt: daysAgo(2), lines: [[listingY, 'Spark Plug', 4, 25000], [listingX, 'Brake Pad', 1, 150000]] });
  // Cancelled: counts as an order, not a sale.
  await insertParcel({ seller: sellerA, createdAt: daysAgo(4), status: 'cancelled', lines: [[listingY, 'Spark Plug', 10, 25000]] });
  // 40 days ago: in the previous 30-day period only.
  await insertParcel({ seller: sellerA, createdAt: daysAgo(40), status: 'delivered', shippedAt: daysAgo(40, 20), deliveredAt: daysAgo(38), lines: [[listingX, 'Brake Pad', 1, 150000]] });
  await ReturnRequest.collection.insertOne({ seller: sellerA._id, createdAt: daysAgo(0, 2), status: 'requested' });
});

after(async () => {
  await mongoose.disconnect();
});

const perf = (token, seller, query = '') => request(app).get(`/api/seller/performance${query}`).set('Authorization', `Bearer ${token}`).set('X-Seller-Id', seller._id.toString());

test('the nightly job backfills sellers that have orders but no stats yet', async () => {
  const rebuilt = await runNightlyStats();
  assert.equal(rebuilt, 1, 'only seller A has orders');
  const rows = await SellerDailyStats.countDocuments({ seller: sellerA._id });
  assert.ok(rows >= 41, `expected a row for every day since the first order, got ${rows}`);
  assert.equal(await SellerDailyStats.countDocuments({ seller: sellerB._id }), 0);
});

test('30-day KPIs: sales exclude cancellations, rates use the right denominators', async () => {
  const res = await perf(tokens.a, sellerA, '?days=30');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const t = res.body.totals;
  assert.equal(t.orders, 3);
  assert.equal(t.cancelled, 1);
  assert.equal(t.salesCents, 300000 + 100000 + 150000);
  assert.equal(t.averageOrderCents, Math.round(550000 / 2));
  assert.equal(t.itemsSold, 2 + 4 + 1);
  assert.ok(Math.abs(t.cancellationRate - 1 / 3) < 1e-9);
  assert.equal(t.onTimeDispatchRate, 0.5, 'one of two shipped parcels went out within 48h');
  assert.equal(t.returnRate, 1, 'one return for one delivered parcel');

  assert.equal(res.body.series.length, 30);
  assert.equal(res.body.series.at(-1).day, dayKey(new Date()));
  assert.equal(res.body.series.reduce((s, d) => s + d.orders, 0), 3);

  assert.equal(res.body.topListings[0].title, 'Brake Pad');
  assert.equal(res.body.topListings[0].qty, 3);
  assert.equal(res.body.topListings[0].salesCents, 450000);
  assert.equal(res.body.topListings[1].title, 'Spark Plug');
  assert.equal(res.body.topListings[1].salesCents, 100000, 'the cancelled spark plugs are not sales');

  assert.equal(res.body.previous.orders, 1);
  assert.equal(res.body.previous.salesCents, 150000);
});

test('7-day view only counts the last 7 Colombo days', async () => {
  const res = await perf(tokens.a, sellerA, '?days=7');
  assert.equal(res.body.series.length, 7);
  assert.equal(res.body.totals.orders, 3);
  assert.equal(res.body.previous.orders, 0);
});

test('a later change (cancelling a shipped parcel) shows after the rebuild', async () => {
  await SellerOrder.collection.updateOne({ _id: lateOrderId }, { $set: { status: 'cancelled' } });
  await rebuildSellerStats(sellerA._id, dayKey(daysAgo(6)), dayKey(new Date()));
  const res = await perf(tokens.a, sellerA, '?days=30');
  assert.equal(res.body.totals.cancelled, 2);
  assert.equal(res.body.totals.salesCents, 300000);
});

test('staff can see performance; each seller only sees their own; days is validated', async () => {
  assert.equal((await perf(tokens.aStaff, sellerA)).status, 200);
  const other = await perf(tokens.b, sellerB);
  assert.equal(other.status, 200);
  assert.equal(other.body.totals.orders, 0);
  assert.equal(other.body.totals.cancellationRate, null, 'no orders means no rate, not 0%');
  assert.equal((await perf(tokens.b, sellerA)).status, 404, 'not a member of seller A');
  assert.equal((await perf(tokens.a, sellerA, '?days=14')).status, 400);
});
