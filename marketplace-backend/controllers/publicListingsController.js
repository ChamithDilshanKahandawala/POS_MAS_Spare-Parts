const Listing = require('../models/Listing');
const Category = require('../models/Category');
const Seller = require('../models/Seller');
const { getDescendantAndSelfIds } = require('../services/categoryRules');
const { toPublicListing } = require('../services/listingPublicView');
const { clampLimit } = require('../utils/pagination');

const MAX_LIMIT = 60;
const SORTS = {
  newest: { publishedAt: -1 },
  price_asc: { priceCents: 1 },
  price_desc: { priceCents: -1 },
};

// Visibility rule shared by both routes below: published, in stock, the
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

// GET /api/public/listings
const listPublicListings = async (req, res) => {
  const {
    category, search, make, model, year, priceMin, priceMax, condition, sort = 'newest', page = 1, limit = 24,
  } = req.query;

  const query = await visibilityFilter();

  if (category) {
    const ids = await getDescendantAndSelfIds(category);
    query.categoryId = { $in: query.categoryId.$in.filter((id) => ids.includes(String(id))) };
  }
  if (condition) query.condition = condition;
  if (priceMin || priceMax) {
    query.priceCents = {};
    if (priceMin) query.priceCents.$gte = Number(priceMin);
    if (priceMax) query.priceCents.$lte = Number(priceMax);
  }
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
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
    query.fitment = { $elemMatch: elem };
  }

  const safeLimit = clampLimit(limit, 24, MAX_LIMIT);
  const sortObj = SORTS[sort] || SORTS.newest;

  const [listings, total] = await Promise.all([
    Listing.find(query).sort(sortObj).skip((page - 1) * safeLimit).limit(safeLimit)
      .populate('images').populate('seller', 'name displayName district slug').lean(),
    Listing.countDocuments(query),
  ]);

  res.json({
    listings: listings.map((l) => toPublicListing(l)),
    total,
    page: Number(page),
    pages: Math.ceil(total / safeLimit),
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

module.exports = { listPublicListings, getPublicListingDetail };
