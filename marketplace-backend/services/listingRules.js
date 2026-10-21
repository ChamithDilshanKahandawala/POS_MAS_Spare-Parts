const Listing = require('../models/Listing');
const PlatformSettings = require('../models/PlatformSettings');
const { getEffectiveCommissionBps } = require('./categoryRules');

// Content fields: changing any of these on a PUBLISHED listing goes
// through the review-or-not decision and, if review applies, becomes a
// pending revision rather than going live immediately. Everything else
// (price, stock, lowStockAlert, status hide/show) applies instantly —
// controllers/sellerListingsController.js is the only place that reads
// this list.
const CONTENT_FIELDS = ['title', 'description', 'categoryId', 'brand', 'condition', 'attributes', 'fitment', 'images'];

// How many of a seller's listings have EVER been published — not a
// simple status==='published' count, since a listing can later be
// hidden/suspended without that meaning the seller is a newcomer again.
async function countEverPublished(sellerId) {
  return Listing.countDocuments({ seller: sellerId, firstPublishedAt: { $ne: null } });
}

async function isSellerOnProbation(sellerId) {
  const settings = await PlatformSettings.findById('platform-settings').lean();
  const threshold = settings?.reviewRequiredForFirstNListings ?? 20;
  if (threshold <= 0) return false;
  const published = await countEverPublished(sellerId);
  return published < threshold;
}

// Whether a draft-submit or a content revision needs admin review before
// going live. `categoryChanged` forces review unconditionally — "Changing
// category on a published listing always needs review" (the spec's own
// words), overriding even reviewExempt.
async function needsReview({ seller, effective, categoryChanged = false }) {
  if (categoryChanged) return true;
  if (seller.reviewExempt) return false;
  if (effective.reviewRequired || effective.regulated) return true;
  return isSellerOnProbation(seller._id);
}

// "You'll receive about Rs X" — seller's effective commission rate
// (category rate, or their own override if set) applied to a price.
function commissionPreview({ category, seller, priceCents }) {
  const bps = getEffectiveCommissionBps(category, seller);
  const commissionCents = Math.round((priceCents * bps) / 10000);
  return { commissionBps: bps, commissionCents, youReceiveCents: priceCents - commissionCents };
}

// Status transitions. `role` restricts who may trigger it:
// 'seller' | 'admin' | 'system' (an automatic submit-time result).
const TRANSITIONS = {
  'draft->in_review': { from: 'draft', to: 'in_review', role: 'system' },
  'draft->published': { from: 'draft', to: 'published', role: 'system' },
  'in_review->published': { from: 'in_review', to: 'published', role: 'admin' },
  'in_review->rejected': { from: 'in_review', to: 'rejected', role: 'admin' },
  'rejected->draft': { from: 'rejected', to: 'draft', role: 'seller' },
  'published->hidden': { from: 'published', to: 'hidden', role: 'seller' },
  'hidden->published': { from: 'hidden', to: 'published', role: 'seller' },
  'published->suspended': { from: 'published', to: 'suspended', role: 'admin' },
  'hidden->suspended': { from: 'hidden', to: 'suspended', role: 'admin' },
  'suspended->published': { from: 'suspended', to: 'published', role: 'admin' },
  'suspended->hidden': { from: 'suspended', to: 'hidden', role: 'admin' },
};

function canTransition(from, to) {
  const key = `${from}->${to}`;
  return TRANSITIONS[key] || null;
}

module.exports = {
  CONTENT_FIELDS,
  isSellerOnProbation,
  needsReview,
  commissionPreview,
  canTransition,
  countEverPublished,
};
