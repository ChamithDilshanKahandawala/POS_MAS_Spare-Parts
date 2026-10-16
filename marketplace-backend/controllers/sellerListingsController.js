const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const Category = require('../models/Category');
const Media = require('../models/Media');
const Seller = require('../models/Seller');
const { getEffectiveCategory } = require('../services/categoryRules');
const { runListingChecks } = require('../services/listingChecks');
const { needsReview, commissionPreview, CONTENT_FIELDS } = require('../services/listingRules');
const { logAction } = require('../services/auditLog');
const { clampLimit } = require('../utils/pagination');
const { deleteFile } = require('../services/storage');

const MAX_LISTINGS_LIMIT = 100;
const STATUSES_FOR_COUNTS = ['draft', 'in_review', 'published', 'rejected', 'hidden', 'suspended'];

async function adjustCategoryListingCount(categoryId, delta) {
  if (!categoryId) return;
  await Category.updateOne({ _id: categoryId }, { $inc: { listingCount: delta } });
}

function hasAnyContentField(body) {
  return CONTENT_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(body, f));
}

function mergedPlainListing(listing, body) {
  const base = listing.toObject ? listing.toObject() : { ...listing };
  for (const field of CONTENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) base[field] = body[field];
  }
  return base;
}

async function resolveEffective(categoryId) {
  const resolved = await getEffectiveCategory(categoryId);
  if (!resolved) return null;
  return resolved;
}

// GET /api/seller/listings — status tabs (with counts), search, category
// filter, pagination. `needsUpdate=true` is its own pseudo-tab (an
// existing status plus a flag, not a status of its own).
const listListings = async (req, res) => {
  const { status, needsUpdate, search, categoryId, page = 1, limit = 20 } = req.query;
  const query = { seller: req.sellerId };
  if (status) query.status = status;
  if (needsUpdate === 'true') query.needsUpdate = true;
  if (categoryId) query.categoryId = categoryId;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ 'title.en': { $regex: escaped, $options: 'i' } }, { sku: { $regex: escaped, $options: 'i' } }];
  }

  const safeLimit = clampLimit(limit, 20, MAX_LISTINGS_LIMIT);
  const sellerObjectId = new mongoose.Types.ObjectId(req.sellerId);
  const [listings, total, counts, needsUpdateCount] = await Promise.all([
    Listing.find(query).sort({ updatedAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit).populate('images'),
    Listing.countDocuments(query),
    Listing.aggregate([{ $match: { seller: sellerObjectId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Listing.countDocuments({ seller: req.sellerId, needsUpdate: true }),
  ]);

  const countsByStatus = Object.fromEntries(STATUSES_FOR_COUNTS.map((s) => [s, 0]));
  for (const row of counts) if (countsByStatus[row._id] !== undefined) countsByStatus[row._id] = row.count;

  res.json({
    listings: listings.map((l) => ({ ...l.toObject(), hasPendingRevision: !!l.pendingRevision?.fields })),
    total,
    page: Number(page),
    pages: Math.ceil(total / safeLimit),
    counts: { ...countsByStatus, all: Object.values(countsByStatus).reduce((a, b) => a + b, 0), needsUpdate: needsUpdateCount },
  });
};

// GET /api/seller/listings/:id
const getListingDetail = async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, seller: req.sellerId }).populate('images');
  if (!listing) return res.status(404).json({ message: 'Listing not found' });

  const resolved = await resolveEffective(listing.categoryId);
  const seller = await Seller.findById(req.sellerId);

  res.json({
    listing,
    effective: resolved?.effective || null,
    category: resolved?.category || null,
    commission: listing.priceCents > 0 && resolved
      ? commissionPreview({ category: resolved.category, seller, priceCents: listing.priceCents })
      : null,
  });
};

// POST /api/seller/listings — step 1 of the wizard: pick a category,
// get back a real draft id so every following step can autosave against
// it (PATCH).
const createListing = async (req, res) => {
  const { categoryId } = req.body;
  const resolved = await resolveEffective(categoryId);
  if (!resolved) return res.status(404).json({ message: 'Category not found' });

  const listing = await Listing.create({
    seller: req.sellerId,
    categoryId,
    categorySchemaVersion: resolved.category.schemaVersion,
    statusHistory: [{ from: null, to: 'draft', by: req.user._id, at: new Date() }],
  });
  await adjustCategoryListingCount(categoryId, 1);

  await logAction({
    actor: req.user,
    actorRole: req.sellerMember.role,
    action: 'listing.create',
    targetType: 'Listing',
    targetId: listing._id,
    after: listing.toObject(),
    summary: `Started a new draft listing in "${resolved.category.name.en}"`,
  });

  res.status(201).json({ listing });
};

// PATCH /api/seller/listings/:id — autosave (draft/rejected), instant
// fields always apply, content fields on a live listing go through the
// review decision and either apply immediately or become a pending
// revision. Never allowed while in_review or suspended — the content is
// either already waiting on a decision or locked until an admin
// reinstates it.
const updateListing = async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!listing) return res.status(404).json({ message: 'Listing not found' });

  if (['in_review', 'suspended'].includes(listing.status)) {
    return res.status(409).json({ message: `Cannot edit a listing that is "${listing.status}".` });
  }

  const body = { ...req.body };

  // images: every id must be Media this seller owns — never another
  // seller's (404, not 400 — same "can't confirm it exists" reasoning as
  // requireSellerMember's X-Seller-Id handling).
  if (body.images) {
    const owned = await Media.find({ _id: { $in: body.images }, seller: req.sellerId });
    if (owned.length !== body.images.length) return res.status(404).json({ message: 'One or more photos were not found' });
    const previousIds = (listing.images || []).map(String);
    const nextIds = body.images.map(String);
    const removed = previousIds.filter((id) => !nextIds.includes(id));
    if (removed.length) await Media.updateMany({ _id: { $in: removed } }, { listing: null });
    await Media.updateMany({ _id: { $in: nextIds } }, { listing: listing._id });
  }

  const before = listing.toObject();
  const instantFields = ['priceCents', 'wasPriceCents', 'stock', 'lowStockAlert'];
  let priceChanged = false;
  const weightChanged = Object.prototype.hasOwnProperty.call(body, 'weightGrams') && body.weightGrams !== before.weightGrams;

  for (const field of instantFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      if (field === 'priceCents' && body.priceCents !== listing.priceCents) priceChanged = true;
      listing[field] = body[field];
    }
  }
  if (priceChanged) listing.priceHistory.push({ priceCents: listing.priceCents, setAt: new Date() });

  const editingRejected = listing.status === 'rejected' && hasAnyContentField(body);
  if (editingRejected) {
    listing.status = 'draft';
    listing.rejectionReasons = [];
    listing.rejectionNote = '';
    listing.statusHistory.push({ from: 'rejected', to: 'draft', by: req.user._id, reason: 'Seller edited after rejection', at: new Date() });
  }

  if (listing.status === 'draft') {
    // Drafts save freely — checks only run at submit, so an in-progress
    // wizard step is never blocked by an incomplete earlier step.
    for (const field of CONTENT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) listing[field] = body[field];
    }
    if (body.categoryId && String(body.categoryId) !== String(before.categoryId)) {
      await adjustCategoryListingCount(before.categoryId, -1);
      await adjustCategoryListingCount(body.categoryId, 1);
    }
    for (const field of ['sku', 'weightGrams', 'dimensions', 'warranty']) {
      if (Object.prototype.hasOwnProperty.call(body, field)) listing[field] = body[field];
    }
    if (weightChanged) listing.weightHistory.push({ weightGrams: listing.weightGrams, by: req.user._id, at: new Date() });
    await listing.save();
    await logAction({
      actor: req.user, actorRole: req.sellerMember.role, action: 'listing.update', targetType: 'Listing',
      targetId: listing._id, before, after: listing.toObject(), summary: `Updated draft listing "${listing.title?.en || listing._id}"`,
    });
    return res.json({ listing });
  }

  // published / hidden: instant fields already applied above. sku/
  // weightGrams/dimensions/warranty aren't in CONTENT_FIELDS (shipping/
  // internal details, not customer-facing content) so they apply
  // instantly too. brand and condition ARE content fields — deliberately
  // NOT touched here; they're only ever written via contentPatch below,
  // gated by the review decision like every other content field.
  for (const field of ['sku', 'weightGrams', 'dimensions', 'warranty']) {
    if (Object.prototype.hasOwnProperty.call(body, field)) listing[field] = body[field];
  }
  if (weightChanged) listing.weightHistory.push({ weightGrams: listing.weightGrams, by: req.user._id, at: new Date() });
  await listing.save();

  if (!hasAnyContentField(body)) {
    await logAction({
      actor: req.user, actorRole: req.sellerMember.role, action: 'listing.update', targetType: 'Listing',
      targetId: listing._id, before, after: listing.toObject(), summary: `Updated listing "${listing.title?.en || listing._id}" (instant fields)`,
    });
    return res.json({ listing });
  }

  const categoryChanged = body.categoryId !== undefined && String(body.categoryId) !== String(before.categoryId);
  const targetCategoryId = categoryChanged ? body.categoryId : listing.categoryId;
  const resolved = await resolveEffective(targetCategoryId);
  if (!resolved) return res.status(404).json({ message: 'Category not found' });

  const merged = mergedPlainListing(listing, body);
  merged.categoryId = targetCategoryId;
  const problems = runListingChecks(merged, resolved.effective);
  if (problems.length > 0) return res.json({ listing, problems });

  const seller = await Seller.findById(req.sellerId);
  const reviewRequired = await needsReview({ seller, effective: resolved.effective, categoryChanged });

  const contentPatch = {};
  for (const field of CONTENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) contentPatch[field] = body[field];
  }

  if (reviewRequired) {
    listing.pendingRevision = { fields: { ...(listing.pendingRevision?.fields || {}), ...contentPatch }, submittedAt: new Date() };
    await listing.save();
    await logAction({
      actor: req.user, actorRole: req.sellerMember.role, action: 'listing.revision.submit', targetType: 'Listing',
      targetId: listing._id, before, after: listing.toObject(), summary: `Submitted a revision for review on "${listing.title?.en}"`,
    });
    return res.json({ listing, pendingReview: true });
  }

  Object.assign(listing, contentPatch);
  listing.categorySchemaVersion = resolved.category.schemaVersion;
  listing.needsUpdate = false;
  listing.version += 1;
  if (categoryChanged) {
    await adjustCategoryListingCount(before.categoryId, -1);
    await adjustCategoryListingCount(targetCategoryId, 1);
  }
  await listing.save();
  await logAction({
    actor: req.user, actorRole: req.sellerMember.role, action: 'listing.update', targetType: 'Listing',
    targetId: listing._id, before, after: listing.toObject(), summary: `Updated listing "${listing.title?.en}" (no review required)`,
  });
  res.json({ listing });
};

// POST /api/seller/listings/:id/check — dry run, never saves. Lets the
// wizard's Preview step show a live problem checklist before Submit.
const checkListingDraft = async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!listing) return res.status(404).json({ message: 'Listing not found' });

  const resolved = await resolveEffective(listing.categoryId);
  if (!resolved) return res.status(404).json({ message: 'Category not found' });

  const problems = runListingChecks(listing.toObject(), resolved.effective);
  res.json({ problems });
};

// POST /api/seller/listings/:id/submit — draft/rejected -> in_review or
// published, per the checks + review decision.
const submitListing = async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!listing) return res.status(404).json({ message: 'Listing not found' });
  if (!['draft', 'rejected'].includes(listing.status)) {
    return res.status(409).json({ message: `Cannot submit: listing is "${listing.status}", not draft or rejected.` });
  }

  const resolved = await resolveEffective(listing.categoryId);
  if (!resolved) return res.status(404).json({ message: 'Category not found' });

  const problems = runListingChecks(listing.toObject(), resolved.effective);
  if (problems.length > 0) return res.json({ listing, problems });

  const seller = await Seller.findById(req.sellerId);
  const reviewRequired = await needsReview({ seller, effective: resolved.effective, categoryChanged: false });

  const from = listing.status;
  const to = reviewRequired ? 'in_review' : 'published';
  listing.status = to;
  listing.rejectionReasons = [];
  listing.rejectionNote = '';
  listing.statusHistory.push({ from, to, by: req.user._id, at: new Date() });
  if (to === 'published') {
    listing.publishedAt = new Date();
    if (!listing.firstPublishedAt) listing.firstPublishedAt = new Date();
  }
  await listing.save();

  await logAction({
    actor: req.user, actorRole: req.sellerMember.role, action: 'listing.submit', targetType: 'Listing',
    targetId: listing._id, before: { status: from }, after: { status: to },
    summary: `Submitted "${listing.title?.en}": ${from} → ${to}`,
  });

  res.json({ listing });
};

// POST /api/seller/listings/:id/hide, /show — published <-> hidden only.
function hideShowHandler(action, from, to) {
  return async (req, res) => {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.sellerId });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.status !== from) return res.status(409).json({ message: `Cannot ${action}: listing is "${listing.status}", not "${from}".` });

    listing.status = to;
    listing.statusHistory.push({ from, to, by: req.user._id, at: new Date() });
    await listing.save();

    await logAction({
      actor: req.user, actorRole: req.sellerMember.role, action: `listing.${action}`, targetType: 'Listing',
      targetId: listing._id, before: { status: from }, after: { status: to }, summary: `${action === 'hide' ? 'Hid' : 'Unhid'} "${listing.title?.en}"`,
    });
    res.json({ listing });
  };
}
const hideListing = hideShowHandler('hide', 'published', 'hidden');
const showListing = hideShowHandler('show', 'hidden', 'published');

// DELETE /api/seller/listings/:id — drafts only.
const deleteListing = async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!listing) return res.status(404).json({ message: 'Listing not found' });
  if (listing.status !== 'draft') return res.status(409).json({ message: 'Only draft listings can be deleted.' });

  const media = await Media.find({ listing: listing._id });
  for (const m of media) {
    for (const size of ['thumb', 'medium', 'large']) {
      deleteFile(m.variants[size].webp);
      deleteFile(m.variants[size].jpg);
    }
  }
  await Media.deleteMany({ listing: listing._id });
  await adjustCategoryListingCount(listing.categoryId, -1);
  await listing.deleteOne();

  await logAction({
    actor: req.user, actorRole: req.sellerMember.role, action: 'listing.delete', targetType: 'Listing',
    targetId: listing._id, before: listing.toObject(), summary: `Deleted draft listing "${listing.title?.en || listing._id}"`,
  });
  res.json({ message: 'Deleted' });
};

// POST /api/seller/listings/:id/duplicate — copies text/attribute
// fields into a fresh draft. Photos are NOT copied (avoids the
// complexity of two listings sharing ownership of the same Media rows) —
// the seller re-uploads for the new listing.
const duplicateListing = async (req, res) => {
  const original = await Listing.findOne({ _id: req.params.id, seller: req.sellerId });
  if (!original) return res.status(404).json({ message: 'Listing not found' });

  const copy = await Listing.create({
    seller: req.sellerId,
    title: original.title,
    description: original.description,
    categoryId: original.categoryId,
    brand: original.brand,
    condition: original.condition,
    sku: '',
    attributes: original.attributes,
    fitment: original.fitment,
    priceCents: original.priceCents,
    stock: 0,
    weightGrams: original.weightGrams,
    dimensions: original.dimensions,
    warranty: original.warranty,
    categorySchemaVersion: original.categorySchemaVersion,
    statusHistory: [{ from: null, to: 'draft', by: req.user._id, at: new Date() }],
  });
  await adjustCategoryListingCount(original.categoryId, 1);

  await logAction({
    actor: req.user, actorRole: req.sellerMember.role, action: 'listing.duplicate', targetType: 'Listing',
    targetId: copy._id, after: copy.toObject(), summary: `Duplicated "${original.title?.en}" into a new draft`,
  });
  res.status(201).json({ listing: copy });
};

// GET /api/seller/listings/commission-preview?categoryId=&priceCents=
const getCommissionPreview = async (req, res) => {
  const { categoryId, priceCents } = req.query;
  const resolved = await resolveEffective(categoryId);
  if (!resolved) return res.status(404).json({ message: 'Category not found' });
  const seller = await Seller.findById(req.sellerId);
  res.json(commissionPreview({ category: resolved.category, seller, priceCents: Number(priceCents) }));
};

module.exports = {
  listListings,
  getListingDetail,
  createListing,
  updateListing,
  checkListingDraft,
  submitListing,
  hideListing,
  showListing,
  deleteListing,
  duplicateListing,
  getCommissionPreview,
};
