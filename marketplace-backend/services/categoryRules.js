const Category = require('../models/Category');
const PlatformSettings = require('../models/PlatformSettings');

// Every category this one descends from, root first, this category last.
// Walks parentId pointers rather than trusting any cached path, since a
// category can be re-parented (not exposed yet, but this stays correct
// if it ever is).
async function getAncestorChain(category) {
  const chain = [category];
  let current = category;
  while (current.parentId) {
    current = await Category.findById(current.parentId);
    if (!current) break;
    chain.unshift(current);
  }
  return chain;
}

// Merges one category's own rules with whatever it inherits from its
// ancestors — "Children inherit return policy, regulated, reviewRequired
// and attribute fields from parents unless overridden" (the spec's exact
// words). null on a category's own field means "not set here, inherit";
// commissionRateBps is deliberately NOT in this list — the spec never
// says commission inherits, only these four things do.
function mergeEffectiveRules(chain) {
  let returnable = false; // platform default when nothing in the chain ever sets it
  let windowDays = 0;
  let returnNote = { en: '', si: '', ta: '' };
  let regulated = false;
  let reviewRequired = false;
  const attributeSchema = [];
  const keywordSet = new Set();

  for (const cat of chain) {
    if (cat.returnPolicy?.returnable !== null && cat.returnPolicy?.returnable !== undefined) returnable = cat.returnPolicy.returnable;
    if (cat.returnPolicy?.windowDays !== null && cat.returnPolicy?.windowDays !== undefined) windowDays = cat.returnPolicy.windowDays;
    if (cat.returnPolicy?.note?.en) returnNote = cat.returnPolicy.note;
    if (cat.regulated !== null && cat.regulated !== undefined) regulated = cat.regulated;
    if (cat.reviewRequired !== null && cat.reviewRequired !== undefined) reviewRequired = cat.reviewRequired;

    for (const kw of cat.prohibitedKeywords || []) keywordSet.add(kw.toLowerCase());

    // A field with the same `key` as an already-accumulated (inherited)
    // one is an override — replaces it in place rather than duplicating,
    // so a child can redefine a field it inherited without the listing
    // form showing it twice.
    const leaf = chain[chain.length - 1];
    for (const field of cat.attributeSchema || []) {
      const existingIndex = attributeSchema.findIndex((f) => f.key === field.key);
      const entry = { ...(field.toObject ? field.toObject() : field), inheritedFrom: cat._id.equals(leaf._id) ? null : { id: cat._id, name: cat.name } };
      if (existingIndex >= 0) attributeSchema[existingIndex] = entry;
      else attributeSchema.push(entry);
    }
  }

  return {
    returnPolicy: { returnable, windowDays, note: returnNote },
    regulated,
    reviewRequired,
    attributeSchema,
    prohibitedKeywords: [...keywordSet],
  };
}

// The one function every GET-with-effective-rules route (admin preview,
// seller catalog, public tree if it ever needs rules) goes through.
// Global platform keywords are merged in here too, not in
// mergeEffectiveRules, since they come from a different collection.
async function getEffectiveCategory(categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) return null;

  const chain = await getAncestorChain(category);
  const effective = mergeEffectiveRules(chain);

  const settings = await PlatformSettings.findById('platform-settings');
  const globalKeywords = (settings?.prohibitedKeywords || []).map((k) => k.toLowerCase());
  const prohibitedKeywords = [...new Set([...globalKeywords, ...effective.prohibitedKeywords])];

  return {
    category,
    effective: { ...effective, prohibitedKeywords, commissionRateBps: category.commissionRateBps },
  };
}

// Seller's effective commission for a category — the 1A seller-level
// commissionOverridePct (a PERCENT, e.g. 2.5) always wins over the
// category's own commissionRateBps (BASIS POINTS, e.g. 250 for 2.5%).
// Converts to one common unit (bps) so callers never have to.
function getEffectiveCommissionBps(category, seller) {
  if (seller?.commissionOverridePct !== null && seller?.commissionOverridePct !== undefined) {
    return Math.round(seller.commissionOverridePct * 100);
  }
  return category.commissionRateBps;
}

// Builds a nested tree from a flat, active-only list of categories —
// used by every tree-shaped response (admin, seller, public), each
// trimming the per-node fields it actually returns.
function buildTree(categories, parentId = null) {
  return categories
    .filter((c) => String(c.parentId || '') === String(parentId || ''))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ category: c, children: buildTree(categories, c._id) }));
}

module.exports = { getAncestorChain, mergeEffectiveRules, getEffectiveCategory, getEffectiveCommissionBps, buildTree, MAX_DEPTH: require('../models/Category').MAX_DEPTH };
