// Milestone 5 Part B — public catalog additions: relevance search,
// facets, fitment filter, store page, related listings. Each test file
// is its own process (see tests/helpers.js) against a shared in-memory
// database, so this sets up its own sellers/categories/listings rather
// than relying on milestone3.test.js's.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, wipeDatabase, Seller, Category, Listing, Media, mongoose,
} = require('./helpers');
const VehicleMake = require('../models/VehicleMake');

const name = (en) => ({ en, si: '', ta: '' });

let sellerActive, sellerSuspended;
let catActive, catInactive;
let make;
let fakeImageId;

function publishedListing(overrides = {}) {
  return {
    seller: sellerActive._id,
    categoryId: catActive._id,
    status: 'published',
    stock: 10,
    priceCents: 100000,
    brand: 'Bosch',
    condition: 'new',
    title: name('Test part'),
    description: name('A real test listing, long enough to be realistic for search purposes.'),
    publishedAt: new Date(),
    images: [fakeImageId],
    ...overrides,
  };
}

before(async () => {
  await wipeDatabase();

  sellerActive = await Seller.create({ name: 'Active Store', legalName: 'Active Store Ltd', brNumber: 'BR-ACTIVE', status: 'active', slug: 'active-store', displayName: 'Active Store', district: 'Colombo', aboutText: name('A real test store'), phones: ['0771234567'], whatsapp: '0771234567' });
  sellerSuspended = await Seller.create({ name: 'Suspended Store', legalName: 'Suspended Store Ltd', brNumber: 'BR-SUSP', status: 'suspended', slug: 'suspended-store' });

  catActive = await Category.create({ name: name('Engine Parts'), slug: 'engine-parts-m5', depth: 0, active: true });
  catInactive = await Category.create({ name: name('Retired Category'), slug: 'retired-category-m5', depth: 0, active: false });

  make = await VehicleMake.create({
    name: 'Toyota', type: 'car', active: true,
    models: [{ name: 'Aqua', yearFrom: 2012, yearTo: 2020, active: true }],
  });

  const media = await Media.create({
    seller: sellerActive._id,
    variants: {
      thumb: { webp: '/fake/thumb.webp', jpg: '/fake/thumb.jpg' },
      medium: { webp: '/fake/medium.webp', jpg: '/fake/medium.jpg' },
      large: { webp: '/fake/large.webp', jpg: '/fake/large.jpg' },
    },
  });
  fakeImageId = media._id;
});

after(async () => {
  await mongoose.disconnect();
});

// --- Search relevance ---

test('q= ranks a title match above a match only in the description/attributes', async () => {
  await Listing.deleteMany({});
  const titleMatch = await Listing.create(publishedListing({
    title: name('Spark Plug Ngk Platinum'),
    description: name('A general spark plug for small engines, nothing special here.'),
  }));
  const descriptionOnlyMatch = await Listing.create(publishedListing({
    title: name('Generic Engine Part'),
    description: name('Fits most vehicles, works well as an Ngk Platinum alternative in a pinch.'),
    attributes: { note: 'compatible with Ngk Platinum' },
  }));

  const res = await request(app).get('/api/public/listings').query({ q: 'Ngk Platinum' });
  assert.equal(res.status, 200);
  const ids = res.body.listings.map((l) => l.id);
  assert.ok(ids.includes(String(titleMatch._id)));
  assert.ok(ids.includes(String(descriptionOnlyMatch._id)));
  // Title match ranks first under relevance sort.
  assert.equal(ids[0], String(titleMatch._id));
});

test('q= never returns a draft, out-of-stock, or inactive-category/suspended-seller listing', async () => {
  await Listing.deleteMany({});
  const matchingPublished = await Listing.create(publishedListing({ title: name('Unique Searchable Widget') }));
  await Listing.create(publishedListing({ title: name('Unique Searchable Widget'), status: 'draft' }));
  await Listing.create(publishedListing({ title: name('Unique Searchable Widget'), stock: 0 }));
  await Listing.create(publishedListing({ title: name('Unique Searchable Widget'), categoryId: catInactive._id }));
  await Listing.create(publishedListing({ title: name('Unique Searchable Widget'), seller: sellerSuspended._id }));

  const res = await request(app).get('/api/public/listings').query({ q: 'Unique Searchable Widget' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.listings.map((l) => l.id), [String(matchingPublished._id)]);
});

// --- Facets ---

test('facets never count a hidden listing, and exclude each facet\'s own filter dimension', async () => {
  await Listing.deleteMany({});
  await Listing.create(publishedListing({ brand: 'Bosch', priceCents: 50000 }));
  await Listing.create(publishedListing({ brand: 'Denso', priceCents: 200000 }));
  await Listing.create(publishedListing({ brand: 'Bosch', priceCents: 0, stock: 0 })); // hidden — out of stock
  await Listing.create(publishedListing({ brand: 'NGK', status: 'draft' })); // hidden — not published

  const res = await request(app).get('/api/public/listings').query({ brand: 'Bosch' });
  assert.equal(res.status, 200);

  // Brand facet excludes the brand filter itself, so both Bosch and
  // Denso show up (what else is available if the shopper changed brand) —
  // but never the draft NGK listing.
  const brandValues = res.body.facets.brands.map((b) => b.value).sort();
  assert.deepEqual(brandValues, ['Bosch', 'Denso']);

  // The actual result list IS brand-filtered, unlike the facet.
  assert.equal(res.body.listings.length, 1);
  assert.equal(res.body.total, 1);

  // Unlike the brand facet, the price facet keeps every OTHER active
  // filter (brand=Bosch here) and only drops its own (price) — so this
  // reflects just the one visible Bosch listing (the other Bosch one is
  // hidden: out of stock), never the Denso listing or either hidden one.
  const totalFaceted = res.body.facets.priceRanges.reduce((sum, r) => sum + r.count, 0);
  assert.equal(totalFaceted, 1);
  const nonEmptyBucket = res.body.facets.priceRanges.find((r) => r.count > 0);
  assert.equal(nonEmptyBucket.min, 0);
  assert.equal(nonEmptyBucket.max, 100000);
});

// Milestone 5 follow-up #1 — a real bug report: the storefront showed
// "Rs. 100,000.00 – Rs. 500,000.00" for an item priced Rs. 1,850. The
// actual cause was the frontend formatting a cents value as if it were
// already rupees (fixed in CategoryPageMarketplace.jsx) — this backend
// contract was already correct, but had no test pinning it down with
// real-world prices, so it could regress silently. priceCents (and
// therefore every priceRanges bucket boundary) is ALWAYS in cents,
// matching every other price field in this API — this test exists so a
// future change can't silently flip that unit without a test failing.
test('price facet buckets are in cents (not rupees), and priceMin/priceMax filter correctly at real prices', async () => {
  await Listing.deleteMany({});
  const cheap = await Listing.create(publishedListing({ title: name('Brake Shoe Set'), priceCents: 185000 })); // Rs 1,850
  const mid = await Listing.create(publishedListing({ title: name('Spark Plug'), priceCents: 420000 })); // Rs 4,200
  const expensive = await Listing.create(publishedListing({ title: name('Alternator'), priceCents: 2500000 })); // Rs 25,000

  const res = await request(app).get('/api/public/listings');
  assert.equal(res.status, 200);
  // Rs 1,850 and Rs 4,200 both fall in the Rs 1,000–5,000 bucket, stored
  // as cents: 100000–500000, NOT a label-sized "100,000–500,000" bucket.
  const bucket = res.body.facets.priceRanges.find((r) => r.min === 100000 && r.max === 500000);
  assert.ok(bucket, 'expected a 100000–500000 cents (Rs 1,000–5,000) bucket');
  assert.equal(bucket.count, 2);

  // The price filter itself (priceMin/priceMax query params) is ALSO in
  // cents, matching priceCents directly — Rs 1,000–5,000 as cents:
  const filtered = await request(app).get('/api/public/listings').query({ priceMin: 100000, priceMax: 500000 });
  const ids = filtered.body.listings.map((l) => l.id).sort();
  assert.deepEqual(ids, [String(cheap._id), String(mid._id)].sort());
  assert.ok(!ids.includes(String(expensive._id)));
});

// --- Fitment filter ---

test('fitment filter: make + model + year only matches listings whose range includes that year', async () => {
  await Listing.deleteMany({});
  const fits = await Listing.create(publishedListing({
    title: name('Aqua brake pad'),
    fitment: [{ makeId: make._id, modelName: 'Aqua', yearFrom: 2010, yearTo: 2018 }],
  }));
  const wrongYear = await Listing.create(publishedListing({
    title: name('Aqua brake pad newer'),
    fitment: [{ makeId: make._id, modelName: 'Aqua', yearFrom: 2019, yearTo: 2022 }],
  }));
  const noFitment = await Listing.create(publishedListing({ title: name('Universal brake pad') }));

  const res = await request(app).get('/api/public/listings').query({ make: make._id.toString(), model: 'Aqua', year: 2015 });
  assert.equal(res.status, 200);
  const ids = res.body.listings.map((l) => l.id);
  assert.deepEqual(ids, [String(fits._id)]);
  assert.ok(!ids.includes(String(wrongYear._id)));
  assert.ok(!ids.includes(String(noFitment._id)));
});

// --- Related listings ---

test('related listings: same category, excludes itself, max 8, never a hidden one', async () => {
  await Listing.deleteMany({});
  const current = await Listing.create(publishedListing());
  const siblings = [];
  for (let i = 0; i < 9; i += 1) siblings.push(await Listing.create(publishedListing({ title: name(`Sibling ${i}`) })));
  const otherCategoryCat = await Category.create({ name: name('Other'), slug: `other-m5-${Date.now()}`, depth: 0, active: true });
  const otherCategory = await Listing.create(publishedListing({ categoryId: otherCategoryCat._id }));
  const draftSibling = await Listing.create(publishedListing({ status: 'draft' }));

  const res = await request(app).get(`/api/public/listings/${current._id}/related`);
  assert.equal(res.status, 200);
  assert.ok(res.body.listings.length <= 8);
  const ids = res.body.listings.map((l) => l.id);
  assert.ok(!ids.includes(String(current._id)));
  assert.ok(!ids.includes(String(otherCategory._id)));
  assert.ok(!ids.includes(String(draftSibling._id)));
  assert.ok(siblings.some((s) => ids.includes(String(s._id))));
});

test('related listings 404s for a listing that is not itself publicly visible', async () => {
  const draft = await Listing.create(publishedListing({ status: 'draft' }));
  const res = await request(app).get(`/api/public/listings/${draft._id}/related`);
  assert.equal(res.status, 404);
});

// --- Store page ---

test('store page returns only public-safe fields for an active seller, and 404s otherwise', async () => {
  const res = await request(app).get('/api/public/stores/active-store');
  assert.equal(res.status, 200);
  assert.equal(res.body.store.name, 'Active Store');
  assert.equal(res.body.store.district, 'Colombo');
  const leaked = ['bankAccount', 'posConnection', 'nic', 'legalName', 'brNumber', 'documents', 'verificationNotes', 'commissionOverridePct'];
  for (const field of leaked) assert.equal(field in res.body.store, false, `store response leaked "${field}"`);

  const suspendedRes = await request(app).get('/api/public/stores/suspended-store');
  assert.equal(suspendedRes.status, 404);

  const unknownRes = await request(app).get('/api/public/stores/does-not-exist');
  assert.equal(unknownRes.status, 404);
});

test('store logo/banner 404 when not set, and are never fetchable for a suspended store', async () => {
  const logoRes = await request(app).get('/api/public/stores/active-store/logo');
  assert.equal(logoRes.status, 404);

  const suspendedLogoRes = await request(app).get('/api/public/stores/suspended-store/logo');
  assert.equal(suspendedLogoRes.status, 404);
});

test('listings endpoint filtered by sellerSlug only returns that seller\'s listings', async () => {
  await Listing.deleteMany({});
  const ownListing = await Listing.create(publishedListing());
  const otherSeller = await Seller.create({ name: 'Other Store', legalName: 'Other Store Ltd', brNumber: 'BR-OTHER', status: 'active', slug: 'other-store' });
  const otherListing = await Listing.create(publishedListing({ seller: otherSeller._id }));

  const res = await request(app).get('/api/public/listings').query({ sellerSlug: 'active-store' });
  assert.equal(res.status, 200);
  const ids = res.body.listings.map((l) => l.id);
  assert.deepEqual(ids, [String(ownListing._id)]);
  assert.ok(!ids.includes(String(otherListing._id)));
});
