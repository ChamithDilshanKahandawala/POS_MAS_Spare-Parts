const mongoose = require('mongoose');
const SellerOrder = require('../models/SellerOrder');
const ReturnRequest = require('../models/ReturnRequest');
const SellerDailyStats = require('../models/SellerDailyStats');
const { getPlatformSettings } = require('./platformSettings');
const { getColomboDateParts, colomboDateToUTC } = require('../utils/colomboDate');

// Seller → Performance. Daily rows are rebuilt from orders/returns with a
// handful of grouped aggregations (one pass per metric over the whole date
// range), so the page reads pre-computed rows instead of scanning orders.
const TZ = 'Asia/Colombo';
const DAY_MS = 24 * 3600e3;
const NOT_A_SALE = ['cancelled', 'returned'];
const REBUILD_RECENT_DAYS = 7;
const TOP_LISTINGS = 5;

function dayKey(date) {
  const { year, month, day } = getColomboDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dayStart(key) {
  const [y, m, d] = key.split('-').map(Number);
  return colomboDateToUTC(y, m, d);
}

function daysBetween(fromKey, toKey) {
  const out = [];
  for (let t = dayStart(fromKey).getTime(); t <= dayStart(toKey).getTime(); t += DAY_MS) out.push(dayKey(new Date(t + 3600e3)));
  return out;
}

const byDay = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: TZ } });

// Recomputes every day in [fromKey, toKey] for one seller, including days
// that now have no activity (so a late cancellation is reflected).
async function rebuildSellerStats(sellerId, fromKey, toKey) {
  const seller = new mongoose.Types.ObjectId(String(sellerId));
  const from = dayStart(fromKey);
  const to = new Date(dayStart(toKey).getTime() + DAY_MS);
  const range = { $gte: from, $lt: to };
  const settings = await getPlatformSettings();
  const onTimeMs = (settings.dispatchWithinHours || 48) * 3600e3;

  const [placed, lines, shipped, delivered, returns] = await Promise.all([
    SellerOrder.aggregate([
      { $match: { seller, createdAt: range } },
      { $group: {
        _id: byDay('createdAt'),
        orders: { $sum: 1 },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        salesCents: { $sum: { $cond: [{ $in: ['$status', NOT_A_SALE] }, 0, '$itemsTotalCents'] } },
      } },
    ]),
    SellerOrder.aggregate([
      { $match: { seller, createdAt: range, status: { $nin: NOT_A_SALE } } },
      { $unwind: '$items' },
      { $group: {
        _id: { day: byDay('createdAt'), listing: '$items.listing' },
        title: { $last: '$items.title.en' },
        qty: { $sum: '$items.qty' },
        salesCents: { $sum: '$items.lineTotalCents' },
      } },
    ]),
    SellerOrder.aggregate([
      { $match: { seller, shippedAt: range } },
      { $group: {
        _id: byDay('shippedAt'),
        shipped: { $sum: 1 },
        shippedOnTime: { $sum: { $cond: [{ $lte: [{ $subtract: ['$shippedAt', '$createdAt'] }, onTimeMs] }, 1, 0] } },
      } },
    ]),
    SellerOrder.aggregate([
      { $match: { seller, deliveredAt: range } },
      { $group: { _id: byDay('deliveredAt'), delivered: { $sum: 1 } } },
    ]),
    ReturnRequest.aggregate([
      { $match: { seller, createdAt: range } },
      { $group: { _id: byDay('createdAt'), returnRequests: { $sum: 1 } } },
    ]),
  ]);

  const rows = Object.fromEntries(daysBetween(fromKey, toKey).map((day) => [day, {
    seller, day, orders: 0, cancelled: 0, salesCents: 0, itemsSold: 0, shipped: 0, shippedOnTime: 0, delivered: 0, returnRequests: 0, listings: [],
  }]));
  const merge = (list) => list.forEach(({ _id, ...vals }) => rows[_id] && Object.assign(rows[_id], vals));
  merge(placed); merge(shipped); merge(delivered); merge(returns);
  for (const l of lines) {
    const row = rows[l._id.day];
    if (!row) continue;
    row.itemsSold += l.qty;
    row.listings.push({ listing: l._id.listing, title: l.title || '', qty: l.qty, salesCents: l.salesCents });
  }

  const ops = Object.values(rows).map((row) => ({
    replaceOne: { filter: { seller, day: row.day }, replacement: row, upsert: true },
  }));
  if (ops.length) await SellerDailyStats.bulkWrite(ops, { ordered: false });
  return ops.length;
}

function summarize(rows) {
  const t = rows.reduce((acc, r) => {
    for (const k of ['orders', 'cancelled', 'salesCents', 'itemsSold', 'shipped', 'shippedOnTime', 'delivered', 'returnRequests']) acc[k] += r[k] || 0;
    return acc;
  }, { orders: 0, cancelled: 0, salesCents: 0, itemsSold: 0, shipped: 0, shippedOnTime: 0, delivered: 0, returnRequests: 0 });
  const rate = (n, d) => (d > 0 ? n / d : null);
  const kept = t.orders - t.cancelled;
  return {
    ...t,
    averageOrderCents: kept > 0 ? Math.round(t.salesCents / kept) : null,
    cancellationRate: rate(t.cancelled, t.orders),
    returnRate: rate(t.returnRequests, t.delivered),
    onTimeDispatchRate: rate(t.shippedOnTime, t.shipped),
  };
}

// GET /api/seller/performance?days=7|30|90 — today and yesterday are rebuilt
// live (they change through the day); older days come from the nightly job.
async function getSellerPerformance(sellerId, days, now = new Date()) {
  const today = dayKey(now);
  const fromKey = dayKey(new Date(dayStart(today).getTime() - (days - 1) * DAY_MS + 3600e3));
  const prevFromKey = dayKey(new Date(dayStart(fromKey).getTime() - days * DAY_MS + 3600e3));
  const prevToKey = dayKey(new Date(dayStart(fromKey).getTime() - DAY_MS + 3600e3));
  const yesterday = dayKey(new Date(dayStart(today).getTime() - DAY_MS + 3600e3));

  await rebuildSellerStats(sellerId, yesterday, today);
  const [rows, prevRows] = await Promise.all([
    SellerDailyStats.find({ seller: sellerId, day: { $gte: fromKey, $lte: today } }).lean(),
    SellerDailyStats.find({ seller: sellerId, day: { $gte: prevFromKey, $lte: prevToKey } }).lean(),
  ]);

  const byKey = Object.fromEntries(rows.map((r) => [r.day, r]));
  const series = daysBetween(fromKey, today).map((day) => ({
    day,
    orders: byKey[day]?.orders || 0,
    salesCents: byKey[day]?.salesCents || 0,
    cancelled: byKey[day]?.cancelled || 0,
  }));

  const listingTotals = {};
  for (const r of rows) {
    for (const l of r.listings) {
      const key = String(l.listing);
      listingTotals[key] ||= { listing: l.listing, title: l.title, qty: 0, salesCents: 0 };
      listingTotals[key].qty += l.qty;
      listingTotals[key].salesCents += l.salesCents;
      if (l.title) listingTotals[key].title = l.title;
    }
  }
  const topListings = Object.values(listingTotals).sort((a, b) => b.salesCents - a.salesCents).slice(0, TOP_LISTINGS);

  return { days, from: fromKey, to: today, totals: summarize(rows), previous: summarize(prevRows), series, topListings };
}

// Nightly: recent days for every seller with recent activity (late
// cancellations, deliveries and returns change them), plus a one-time
// backfill for sellers with orders but no stats rows yet.
async function runNightlyStats(now = new Date()) {
  const today = dayKey(now);
  const recentFrom = dayKey(new Date(dayStart(today).getTime() - (REBUILD_RECENT_DAYS - 1) * DAY_MS + 3600e3));
  const since = dayStart(recentFrom);
  const [active, withStats, firstOrders] = await Promise.all([
    SellerOrder.distinct('seller', { $or: [{ createdAt: { $gte: since } }, { shippedAt: { $gte: since } }, { deliveredAt: { $gte: since } }] }),
    SellerDailyStats.distinct('seller'),
    SellerOrder.aggregate([{ $group: { _id: '$seller', first: { $min: '$createdAt' } } }]),
  ]);
  const hasStats = new Set(withStats.map(String));
  let rebuilt = 0;
  for (const { _id, first } of firstOrders) {
    if (!hasStats.has(String(_id))) { await rebuildSellerStats(_id, dayKey(first), today); rebuilt += 1; }
  }
  for (const sellerId of active) {
    if (hasStats.has(String(sellerId))) { await rebuildSellerStats(sellerId, recentFrom, today); rebuilt += 1; }
  }
  return rebuilt;
}

let lastRunDay = null;
function startSellerStatsJob() {
  const tick = async () => {
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(now));
    const today = dayKey(now);
    // Once a day after 01:00 Colombo, and once at startup.
    if (lastRunDay === today || (lastRunDay !== null && hour < 1)) return;
    lastRunDay = today;
    try {
      const n = await runNightlyStats(now);
      console.log(`[sellerStats] rebuilt stats for ${n} seller(s)`);
    } catch (err) {
      console.error('[sellerStats] nightly rebuild failed:', err.message);
      require('./opsAlerts').reportJobFailure('seller-stats', err);
      lastRunDay = null;
    }
  };
  tick();
  setInterval(tick, 3600e3);
}

module.exports = { rebuildSellerStats, getSellerPerformance, runNightlyStats, startSellerStatsJob, dayKey };
