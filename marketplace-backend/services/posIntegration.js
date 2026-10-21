// Milestone 4 — talks to one seller's connected POS (backend/'s
// GET /api/integration/products, a read-only feed) to list importable
// products and keep linked listings' price/stock in sync. This service
// NEVER sends the POS anything but GET requests — see fetchPosProducts,
// the only function that calls out to it at all.
const Listing = require('../models/Listing');
const Category = require('../models/Category');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const PosSyncRun = require('../models/PosSyncRun');
const { decrypt } = require('./encryption');
const { notify } = require('./notifications');

const CONSECUTIVE_FAILURES_BEFORE_NOTIFY = 3;
const PAGE_LIMIT = 200; // matches backend/'s own MAX_LIMIT

class PosFetchError extends Error {}

// One page at a time — the caller (runSync) loops until it's read
// everything. GET only, ever: the fetch options below never set a
// method other than the default GET, and there is no other function in
// this file that calls `fetch` against a POS base URL.
async function fetchPosProductsPage(seller, { updatedSince, page = 1 } = {}) {
  if (!seller.posConnection?.baseUrl) throw new PosFetchError('No POS base URL configured');
  const key = decrypt(seller.posConnection.encryptedKey);

  const url = new URL('/api/integration/products', seller.posConnection.baseUrl);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (updatedSince) url.searchParams.set('updatedSince', updatedSince.toISOString());

  let res;
  try {
    res = await fetch(url, { headers: { 'X-Integration-Key': key } });
  } catch (err) {
    throw new PosFetchError(`Could not reach POS at ${seller.posConnection.baseUrl}: ${err.message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new PosFetchError(`POS returned ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Fetches every page for one query (used by both the Import-from-POS
// browser and the sync job) — capped generously so a misbehaving POS
// (or an unbounded `pages` value) can't loop forever.
async function fetchAllPosProducts(seller, { updatedSince } = {}) {
  const all = [];
  let page = 1;
  for (;;) {
    const data = await fetchPosProductsPage(seller, { updatedSince, page });
    all.push(...data.products);
    if (page >= (data.pages || 1) || page > 100) break;
    page += 1;
  }
  return all;
}

// Best-effort: matches a POS category string to a marketplace Category
// by exact (case-insensitive) English name. Returns null — never throws
// — when nothing matches; the seller picks one in the wizard either way,
// this is just a head start.
async function suggestCategory(posCategoryName) {
  if (!posCategoryName) return null;
  const escaped = posCategoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = await Category.findOne({ 'name.en': { $regex: `^${escaped}$`, $options: 'i' }, active: true }).lean();
  return match ? match._id : null;
}

// GET /api/seller/pos/products — the Import-from-POS browser's data
// source. Annotates each POS product with whether (and to which
// listing) it's already linked, so the console can show "Linked to: ..."
// and the "not yet imported" filter without a second round trip.
async function listImportableProducts(seller, { search, category, notImported } = {}) {
  const products = await fetchAllPosProducts(seller, {});
  const linkedListings = await Listing.find({ seller: seller._id, posProductId: { $exists: true } }).select('posProductId title status').lean();
  const linkedByPosId = new Map(linkedListings.map((l) => [l.posProductId, l]));

  let result = products.map((p) => {
    const linked = linkedByPosId.get(String(p.id));
    return { ...p, linkedListing: linked ? { id: linked._id, title: linked.title?.en || '', status: linked.status } : null };
  });

  if (search) {
    const q = search.toLowerCase();
    result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku_code.toLowerCase().includes(q));
  }
  if (category) result = result.filter((p) => p.category === category);
  if (notImported === true) result = result.filter((p) => !p.linkedListing);

  return result;
}

// POST /api/seller/pos/import — creates one draft Listing per selected
// POS product. The unique sparse index on {seller, posProductId}
// (models/Listing.js) is the real guard against double-importing the
// same product — this pre-check just gives a clean error message
// instead of a raw duplicate-key one.
async function importProducts(seller, posProductIds, actorUserId) {
  const allProducts = await fetchAllPosProducts(seller, {});
  const byId = new Map(allProducts.map((p) => [String(p.id), p]));

  const already = await Listing.find({ seller: seller._id, posProductId: { $in: posProductIds.map(String) } }).select('posProductId').lean();
  const alreadyLinked = new Set(already.map((l) => l.posProductId));

  const created = [];
  const skipped = [];
  for (const posProductId of posProductIds) {
    const id = String(posProductId);
    if (alreadyLinked.has(id)) { skipped.push({ posProductId: id, reason: 'already imported' }); continue; }
    const product = byId.get(id);
    if (!product) { skipped.push({ posProductId: id, reason: 'not found on the POS' }); continue; }

    const categoryId = await suggestCategory(product.category);
    if (!categoryId) {
      // Listing.categoryId is required — there's no "pick it later" on
      // the schema itself, only in the wizard's own UI flow, which this
      // bypasses. Rather than relax the schema for this one caller, a
      // product whose POS category has no marketplace match is skipped
      // with a clear reason; the seller can still add it the normal way
      // (step 1 of the wizard) and the field whitelist from the POS
      // fetch is the same either way.
      skipped.push({ posProductId: id, reason: `no marketplace category matches "${product.category}" — add it through the normal wizard instead` });
      continue;
    }

    const listing = await Listing.create({
      seller: seller._id,
      categoryId,
      posProductId: id,
      title: { en: product.name, si: '', ta: '' },
      brand: product.brand || '',
      sku: product.sku_code || '',
      priceCents: product.selling_price,
      stock: product.stock_quantity,
      statusHistory: [{ from: null, to: 'draft', by: actorUserId, at: new Date() }],
    });
    // Same bookkeeping sellerListingsController.js's own createListing
    // does — listingCount is a display-only counter nudged at every
    // point a listing's categoryId is set, not recomputed live.
    await Category.updateOne({ _id: categoryId }, { $inc: { listingCount: 1 } });
    created.push(listing);
  }

  return { created, skipped };
}

// The sync job's core — called on the 5-minute schedule and by "Sync
// now". Updates priceCents/stock ONLY on already-linked listings; never
// touches title, description, photos, fitment, or status. A product
// that's gone inactive on the POS zeroes the listing's stock (never
// deletes the listing) and notifies the seller once.
async function runSync(sellerId, trigger) {
  const seller = await Seller.findById(sellerId).select('+posConnection.encryptedKey');
  if (!seller || !seller.posConnection?.enabled) return null;

  const run = await PosSyncRun.create({ seller: sellerId, trigger, status: 'running' });
  const errors = [];
  let productsChecked = 0;
  let listingsUpdated = 0;

  try {
    const since = seller.posConnection.lastSuccessfulSyncAt || null;
    const products = await fetchAllPosProducts(seller, { updatedSince: since });
    productsChecked = products.length;

    for (const product of products) {
      const listing = await Listing.findOne({ seller: sellerId, posProductId: String(product.id) });
      if (!listing) continue; // not imported by this seller — nothing to sync

      if (!product.active) {
        if (listing.stock !== 0) {
          listing.stock = 0;
          await listing.save();
          listingsUpdated += 1;
        }
        await notify({
          userId: await ownerUserId(sellerId),
          type: 'pos.product_removed',
          title: `"${listing.title?.en || listing.sku}" is no longer available on the POS`,
          body: 'Stock was set to 0. The listing itself was not deleted — update or hide it if needed.',
          link: `/seller/products/${listing._id}/edit`,
        });
        continue;
      }

      let changed = false;
      if (listing.priceCents !== product.selling_price) {
        listing.priceCents = product.selling_price;
        listing.priceHistory.push({ priceCents: product.selling_price, setAt: new Date(), by: 'POS sync' });
        changed = true;
      }
      if (listing.stock !== product.stock_quantity) {
        listing.stock = product.stock_quantity;
        changed = true;
      }
      if (changed) {
        await listing.save();
        listingsUpdated += 1;
      }
    }

    seller.posConnection.lastSuccessfulSyncAt = new Date();
    seller.posConnection.consecutiveFailures = 0;
    seller.posConnection.failureNotified = false;
    await seller.save();

    run.status = 'success';
  } catch (err) {
    errors.push(err.message);
    run.status = 'failed';

    seller.posConnection.consecutiveFailures += 1;
    if (seller.posConnection.consecutiveFailures >= CONSECUTIVE_FAILURES_BEFORE_NOTIFY && !seller.posConnection.failureNotified) {
      seller.posConnection.failureNotified = true;
      await notifySyncFailing(seller);
    }
    await seller.save();
  }

  run.finishedAt = new Date();
  run.productsChecked = productsChecked;
  run.listingsUpdated = listingsUpdated;
  run.errors = errors;
  await run.save();

  return run;
}

async function ownerUserId(sellerId) {
  const owner = await SellerMember.findOne({ seller: sellerId, role: 'seller_owner', status: 'active' }).select('user').lean();
  return owner?.user;
}

async function notifySyncFailing(seller) {
  const ownerId = await ownerUserId(seller._id);
  if (ownerId) {
    await notify({
      userId: ownerId,
      type: 'pos.sync_failing',
      title: 'POS sync has failed 3 times in a row',
      body: 'Price and stock from your POS may be out of date. Check your POS connection settings.',
      link: '/seller/settings',
    });
  }
  const User = require('../models/User');
  const platformOwners = await User.find({ platformRole: 'platform_owner' }).select('_id').lean();
  await Promise.all(platformOwners.map((owner) => notify({
    userId: owner._id,
    type: 'pos.sync_failing',
    title: `${seller.name}'s POS sync has failed 3 times in a row`,
    body: 'Price and stock from their POS may be out of date.',
    link: `/admin/sellers/${seller._id}`,
  })));
}

module.exports = {
  fetchPosProductsPage,
  fetchAllPosProducts,
  listImportableProducts,
  importProducts,
  runSync,
  suggestCategory,
  PosFetchError,
};
