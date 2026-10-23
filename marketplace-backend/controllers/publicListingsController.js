const Listing = require('../models/Listing');
const Category = require('../models/Category');
const Seller = require('../models/Seller');
const { getDescendantAndSelfIds } = require('../services/categoryRules');
const { toPublicListing } = require('../services/listingPublicView');
const { clampLimit } = require('../utils/pagination');

const MAX_LIMIT = 60;
const RELATED_LIMIT = 8;
const SORTS = {
  newest: { publishedAt: -1 },
  price_asc: { priceCents: 1 },
  price_desc: { priceCents: -1 },
};

// Fixed bands in Rs (stored as priceCents) — this catalog's real prices
// (seeded/live data) run from a few hundred to tens of thousands of
// rupees, so these aren't configurable per the spec's "no advanced
// requirement" scope, just a sensible fixed scheme for facet counts.
const PRICE_BUCKETS = [
  { min: 0, max: 100000 }, // Rs 0 - 1,000
  { min: 100000, max: 500000 }, // Rs 1,000 - 5,000
  { min: 500000, max: 1500000 }, // Rs 5,000 - 15,000
  { min: 1500000, max: 5000000 }, // Rs 15,000 - 50,000
  { min: 5000000, max: null }, // Rs 50,000+
];

// Visibility rule shared by every route below: published, in stock, the
// owning seller active, the owning category active. Built once per
// request from real queries (never trusting a denormalized flag that
// could drift) — this project is small enough that the extra lookups
// are cheap.
async function visibilityFilter() {
  const [activeCategoryIds, activeSellerIds] = await Promise.all([
    Category.find({ active: true }).select('_id').lean().then((rows) => rows.map((r) => r._id)),
    Seller.find({ status: 'active' }).select('_id').lean().then((rows) => rows.map((r) => r._id)),
  ]);
  return { status: 'published', stock: { $gt: 0 }, categoryId: { $in: activeCategoryIds }, seller: { $in: activeSellerIds } };
}

// Builds the Mongo filter from query params on top of visibilityFilter().
// `exclude` leaves one dimension's OWN filter out — used by the facet
// counts below, which must answer "what else is available under every
// OTHER current filter", not "how many of the currently selected value".
async function buildFilter(queryParams, { exclude } = {}) {
  const { category, q, search, brand, sellerSlug, make, model, year, priceMin, priceMax, condition } = queryParams;
  const filter = await visibilityFilter();

  if (sellerSlug) {
    const seller = await Seller.findOne({ slug: sellerSlug, status: 'active' }).select('_id').lean();
    filter.seller = { $in: seller ? [seller._id] : [] };
  }

  if (category) {
    const ids = await getDescendantAndSelfIds(category);
    filter.categoryId = { $in: filter.categoryId.$in.filter((id) => ids.includes(String(id))) };
  }
  if (exclude !== 'condition' && condition) filter.condition = condition;
  if (exclude !== 'brand' && brand) filter.brand = brand;
  if (exclude !== 'price' && (priceMin || priceMax)) {
    filter.priceCents = {};
    if (priceMin) filter.priceCents.$gte = Number(priceMin);
    if (priceMax) filter.priceCents.$lte = Number(priceMax);
  }

  if (q) {
    // Relevance search — the wildcard text index (models/Listing.js)
    // covers title.en/si/ta, brand, sku and every attribute value, with
    // title/brand/sku weighted above an incidental match elsewhere.
    filter.$text = { $search: q };
  } else if (search) {
    // Older plain substring match — kept working as-is for any existing
    // caller; `q` is the new relevance-ranked param the storefront uses.
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { 'title.en': { $regex: escaped, $options: 'i' } },
      { brand: { $regex: escaped, $options: 'i' } },
      { sku: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (make || model || year) {
    const elem = {};
    if (make) elem.makeId = make;
    if (model) elem.modelName = model;
    if (year) {
      const y = Number(year);
      elem.$and = [
        { $or: [{ yearFrom: null }, { yearFrom: { $lte: y } }] },
        { $or: [{ yearTo: null }, { yearTo: { $gte: y } }] },
      ];
    }
    filter.fitment = { $elemMatch: elem };
  }

  return filter;
}

// Three independent counts (brand/condition/price), each built from the
// full current filter with its OWN dimension excluded — never counts a
// listing that visibilityFilter() (or any other active filter) would
// exclude, since every one of these starts from buildFilter(), the same
// function the real listing query uses.
async function buildFacets(queryParams) {
  const [brandFilter, conditionFilter, priceFilter] = await Promise.all([
    buildFilter(queryParams, { exclude: 'brand' }),
    buildFilter(queryParams, { exclude: 'condition' }),
    buildFilter(queryParams, { exclude: 'price' }),
  ]);

  const [brandRows, conditionRows, priceRows] = await Promise.all([
    Listing.aggregate([
      { $match: brandFilter },
      { $match: { brand: { $nin: ['', null] } } },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Listing.aggregate([
      { $match: conditionFilter },
      { $group: { _id: '$condition', count: { $sum: 1 } } },
    ]),
    Promise.all(PRICE_BUCKETS.map(async (bucket) => {
      const bucketFilter = {
        ...priceFilter,
        priceCents: { $gte: bucket.min, ...(bucket.max != null ? { $lt: bucket.max } : {}) },
      };
      const count = await Listing.countDocuments(bucketFilter);
      return { min: bucket.min, max: bucket.max, count };
    })),
  ]);

  return {
    brands: brandRows.map((r) => ({ value: r._id, count: r.count })),
    conditions: conditionRows.map((r) => ({ value: r._id, count: r.count })),
    priceRanges: priceRows,
  };
}

// GET /api/public/listings
const listPublicListings = async (req, res) => {
  const { sort, page = 1, limit = 24 } = req.query;
  const safeLimit = clampLimit(limit, 24, MAX_LIMIT);

  const filter = await buildFilter(req.query);

  const useRelevance = !!req.query.q && !sort;
  let findQuery = Listing.find(filter).populate('images').populate('seller', 'name displayName district slug');
  if (useRelevance) findQuery = findQuery.select({ score: { $meta: 'textScore' } });
  const sortObj = useRelevance ? { score: { $meta: 'textScore' } } : (SORTS[sort] || SORTS.newest);

  const [listings, total, facets] = await Promise.all([
    findQuery.sort(sortObj).skip((page - 1) * safeLimit).limit(safeLimit).lean(),
    Listing.countDocuments(filter),
    buildFacets(req.query),
  ]);

  res.json({
    listings: listings.map((l) => toPublicListing(l)),
    total,
    page: Number(page),
    pages: Math.ceil(total / safeLimit),
    facets,
  });
};

// GET /api/public/listings/:id — same visibility rules as the list; the
// LIVE version only, never a pending revision (there's nothing here that
// ever reads listing.pendingRevision).
const getPublicListingDetail = async (req, res) => {
  const query = await visibilityFilter();
  const listing = await Listing.findOne({ _id: req.params.id, ...query })
    .populate('images').populate('seller', 'name displayName district slug').lean();
  if (!listing) return res.status(404).json({ message: 'Listing not found' });

  res.json({ listing: toPublicListing(listing) });
};

// GET /api/public/listings/:id/related — same category (exact match,
// not the descendant tree listing search uses), excluding itself, max 8.
const getRelatedListings = async (req, res) => {
  const base = await visibilityFilter();
  const current = await Listing.findOne({ _id: req.params.id, ...base }).select('categoryId').lean();
  if (!current) return res.status(404).json({ message: 'Listing not found' });

  const related = await Listing.find({ ...base, categoryId: current.categoryId, _id: { $ne: current._id } })
    .sort({ publishedAt: -1 }).limit(RELATED_LIMIT)
    .populate('images').populate('seller', 'name displayName district slug').lean();

  res.json({ listings: related.map((l) => toPublicListing(l)) });
};

module.exports = { listPublicListings, getPublicListingDetail, getRelatedListings };
