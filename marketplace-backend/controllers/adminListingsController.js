const Listing = require('../models/Listing');
const Category = require('../models/Category');
const Seller = require('../models/Seller');
const SellerMember = require('../models/SellerMember');
const { getEffectiveCategory } = require('../services/categoryRules');
const { countEverPublished, isSellerOnProbation } = require('../services/listingRules');
const { toPublicListing } = require('../services/listingPublicView');
const { logAction } = require('../services/auditLog');
const { notify } = require('../services/notifications');
const { clampLimit } = require('../utils/pagination');

const MAX_QUEUE_LIMIT = 100;

async function regulatedCategoryIds() {
  const categories = await Category.find({});
  const ids = [];
  for (const c of categories) {
    const resolved = await getEffectiveCategory(c._id);
    if (resolved?.effective.regulated) ids.push(c._id);
  }
  return ids;
}

// GET /api/admin/listings — the review queue by default: every
// in_review submission plus every published/hidden listing with a
// pending revision, oldest first (`type=new|revision` narrows to one or
// the other). Passing an explicit `status` switches it to a plain
// listing browser instead (Seller detail's Listings tab: `?seller=
// ...&status=all`, or any one specific status) — same endpoint, two
// jobs, since both are "listings matching some filters, paginated."
const listReviewQueue = async (req, res) => {
  const { seller, category, type, regulated, status, page = 1, limit = 20 } = req.query;

  let query;
  if (status === 'all') {
    query = {};
  } else if (status) {
    query = { status };
  } else {
    const newQuery = { status: 'in_review' };
    const revisionQuery = { status: { $in: ['published', 'hidden'] }, 'pendingRevision.fields': { $ne: null } };
    query = type === 'new' ? newQuery : type === 'revision' ? revisionQuery : { $or: [newQuery, revisionQuery] };
  }

  if (seller) query.seller = seller;
  if (category) query.categoryId = category;
  if (regulated === 'true') {
    const ids = await regulatedCategoryIds();
    query.categoryId = query.categoryId ? query.categoryId : { $in: ids };
  }

  const safeLimit = clampLimit(limit, 20, MAX_QUEUE_LIMIT);
  const [listings, total] = await Promise.all([
    Listing.find(query).sort({ updatedAt: 1 }).skip((page - 1) * safeLimit).limit(safeLimit)
      .populate('seller', 'name displayName status')
      .populate('categoryId', 'name slug'),
    Listing.countDocuments(query),
  ]);

  res.json({
    listings: listings.map((l) => ({
      ...l.toObject(),
      isRevision: !!l.pendingRevision?.fields,
    })),
    total,
    page: Number(page),
    pages: Math.ceil(total / safeLimit),
  });
};

// Diffs the live listing's content fields against a pending revision's
// proposed fields — only the keys that actually differ, each as
// { from, to }, so the console can render a focused side-by-side rather
// than a full before/after dump.
function diffRevision(listing) {
  const proposed = listing.pendingRevision?.fields;
  if (!proposed) return null;
  const diff = {};
  for (const [key, value] of Object.entries(proposed)) {
    const current = listing[key];
    const same = JSON.stringify(current) === JSON.stringify(value);
    if (!same) diff[key] = { from: current, to: value };
  }
  return diff;
}

// GET /api/admin/listings/:id — the listing as a customer would see it,
// plus (for a revision) the live-vs-proposed diff, plus seller/probation
// context an admin needs to decide.
const getReviewDetail = async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate('images').populate('categoryId');
  if (!listing) return res.status(404).json({ message: 'Listing not found' });

  const seller = await Seller.findById(listing.seller);
  const resolved = await getEffectiveCategory(listing.categoryId._id);
  const everPublished = await countEverPublished(listing.seller);
  const onProbation = await isSellerOnProbation(listing.seller);

  res.json({
    listing,
    customerView: toPublicListing({ ...listing.toObject(), seller }),
    effective: resolved?.effective || null,
    isRevision: !!listing.pendingRevision?.fields,
    revisionDiff: diffRevision(listing),
    seller: { id: seller._id, name: seller.name, status: seller.status, reviewExempt: seller.reviewExempt, everPublished, onProbation },
  });
};

async function notifyOwnersAndStaff(sellerId, payload) {
  const members = await SellerMember.find({ seller: sellerId, status: 'active' });
  await Promise.all(members.map((m) => notify({ userId: m.user, ...payload })));
}

// POST /api/admin/listings/:id/approve — a new submission goes live; a
// pending revision's proposed fields merge into the live document.
const approveListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ message: 'Listing not found' });

  const hasRevision = !!listing.pendingRevision?.fields;

  if (listing.status === 'in_review') {
    const before = listing.toObject();
    listing.status = 'published';
    listing.publishedAt = new Date();
    if (!listing.firstPublishedAt) listing.firstPublishedAt = new Date();
    listing.statusHistory.push({ from: 'in_review', to: 'published', by: req.user._id, at: new Date() });
    await listing.save();

    await logAction({
      actor: req.user, actorRole: req.user.platformRole, action: 'listing.approve', targetType: 'Listing',
      targetId: listing._id, before, after: listing.toObject(), summary: `Approved and published "${listing.title.en}"`,
    });
    await notifyOwnersAndStaff(listing.seller, {
      type: 'listing.published', title: `"${listing.title.en}" is now live`, body: 'Your listing was approved and is now visible to customers.', link: `/seller/products/${listing._id}`,
    });
    return res.json({ listing });
  }

  if (hasRevision) {
    const before = listing.toObject();
    const oldCategoryId = String(listing.categoryId);
    Object.assign(listing, listing.pendingRevision.fields);
    const resolved = await getEffectiveCategory(listing.categoryId);
    listing.categorySchemaVersion = resolved?.category.schemaVersion ?? listing.categorySchemaVersion;
    listing.needsUpdate = false;
    listing.version += 1;
    listing.pendingRevision = { fields: null, submittedAt: null };
    await listing.save();

    if (String(listing.categoryId) !== oldCategoryId) {
      await Category.updateOne({ _id: oldCategoryId }, { $inc: { listingCount: -1 } });
      await Category.updateOne({ _id: listing.categoryId }, { $inc: { listingCount: 1 } });
    }

    await logAction({
      actor: req.user, actorRole: req.user.platformRole, action: 'listing.revision.approve', targetType: 'Listing',
      targetId: listing._id, before, after: listing.toObject(), summary: `Approved a revision on "${listing.title.en}"`,
    });
    await notifyOwnersAndStaff(listing.seller, {
      type: 'listing.revision_approved', title: `Your changes to "${listing.title.en}" are live`, body: 'An admin approved your revision.', link: `/seller/products/${listing._id}`,
    });
    return res.json({ listing });
  }

  return res.status(409).json({ message: `Nothing to approve: listing is "${listing.status}" with no pending revision.` });
};

// POST /api/admin/listings/:id/reject — body: { reasons: [...], note }.
// A new submission is rejected outright; a pending revision is simply
// discarded, leaving the live version exactly as it was.
const rejectListing = async (req, res) => {
  const { reasons, note } = req.body;
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ message: 'Listing not found' });

  const hasRevision = !!listing.pendingRevision?.fields;

  if (listing.status === 'in_review') {
    const before = listing.toObject();
    listing.status = 'rejected';
    listing.rejectionReasons = reasons;
    listing.rejectionNote = note || '';
    listing.statusHistory.push({ from: 'in_review', to: 'rejected', by: req.user._id, reason: note || reasons.join(', '), at: new Date() });
    await listing.save();

    await logAction({
      actor: req.user, actorRole: req.user.platformRole, action: 'listing.reject', targetType: 'Listing',
      targetId: listing._id, before, after: listing.toObject(), summary: `Rejected "${listing.title.en}": ${reasons.join(', ')}`,
    });
    await notifyOwnersAndStaff(listing.seller, {
      type: 'listing.rejected', title: `"${listing.title.en}" was not approved`, body: note || reasons.join(', '), link: `/seller/products/${listing._id}`,
    });
    return res.json({ listing });
  }

  if (hasRevision) {
    const before = listing.toObject();
    listing.pendingRevision = { fields: null, submittedAt: null };
    await listing.save();

    await logAction({
      actor: req.user, actorRole: req.user.platformRole, action: 'listing.revision.reject', targetType: 'Listing',
      targetId: listing._id, before, after: listing.toObject(), summary: `Rejected a revision on "${listing.title.en}": ${reasons.join(', ')}`,
    });
    await notifyOwnersAndStaff(listing.seller, {
      type: 'listing.revision_rejected', title: `Your changes to "${listing.title.en}" were not approved`, body: note || reasons.join(', '), link: `/seller/products/${listing._id}`,
    });
    return res.json({ listing });
  }

  return res.status(409).json({ message: `Nothing to reject: listing is "${listing.status}" with no pending revision.` });
};

// POST /api/admin/listings/:id/suspend — body: { reason }. Published or
// hidden only; a pending revision (if any) is left untouched — if the
// listing is later reinstated, that revision is still waiting.
const suspendListing = async (req, res) => {
  const { reason } = req.body;
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ message: 'Listing not found' });
  if (!['published', 'hidden'].includes(listing.status)) {
    return res.status(409).json({ message: `Cannot suspend: listing is "${listing.status}".` });
  }

  const from = listing.status;
  listing.status = 'suspended';
  listing.statusHistory.push({ from, to: 'suspended', by: req.user._id, reason, at: new Date() });
  await listing.save();

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'listing.suspend', targetType: 'Listing',
    targetId: listing._id, before: { status: from }, after: { status: 'suspended' }, summary: `Suspended "${listing.title.en}": ${reason}`,
  });
  await notifyOwnersAndStaff(listing.seller, {
    type: 'listing.suspended', title: `"${listing.title.en}" was suspended`, body: reason, link: `/seller/products/${listing._id}`,
  });
  res.json({ listing });
};

// POST /api/admin/listings/:id/reinstate — body: { to: 'published'|'hidden' }.
const reinstateListing = async (req, res) => {
  const { to } = req.body;
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ message: 'Listing not found' });
  if (listing.status !== 'suspended') return res.status(409).json({ message: `Cannot reinstate: listing is "${listing.status}", not suspended.` });

  listing.status = to;
  listing.statusHistory.push({ from: 'suspended', to, by: req.user._id, at: new Date() });
  await listing.save();

  await logAction({
    actor: req.user, actorRole: req.user.platformRole, action: 'listing.reinstate', targetType: 'Listing',
    targetId: listing._id, before: { status: 'suspended' }, after: { status: to }, summary: `Reinstated "${listing.title.en}" as ${to}`,
  });
  await notifyOwnersAndStaff(listing.seller, {
    type: 'listing.reinstated', title: `"${listing.title.en}" is active again`, body: `Reinstated as ${to}.`, link: `/seller/products/${listing._id}`,
  });
  res.json({ listing });
};

module.exports = { listReviewQueue, getReviewDetail, approveListing, rejectListing, suspendListing, reinstateListing };
