const Category = require('../models/Category');
const Seller = require('../models/Seller');
const { getAncestorChain, mergeEffectiveRules, getEffectiveCommissionBps } = require('../services/categoryRules');
const PlatformSettings = require('../models/PlatformSettings');

// GET /api/seller/catalog/categories — active categories only, each
// carrying ITS OWN effective rules (return policy, regulated,
// reviewRequired, attribute fields) AND the effective commission rate
// for the calling seller specifically — their 1A commissionOverridePct
// always wins over the category's own commissionRateBps
// (getEffectiveCommissionBps). Two sellers viewing the same tree see the
// same rules but can see different commission numbers.
const getSellerCategoryTree = async (req, res) => {
  const [categories, seller, settings] = await Promise.all([
    Category.find({ active: true }).lean(),
    Seller.findById(req.sellerId).select('commissionOverridePct').lean(),
    PlatformSettings.findById('platform-settings').lean(),
  ]);
  if (!seller) return res.status(404).json({ message: 'Seller not found' });

  const globalKeywords = (settings?.prohibitedKeywords || []).map((k) => k.toLowerCase());
  const activeIds = new Set(categories.map((c) => String(c._id)));

  // Resolve effective rules once per category up front (each walks its
  // own ancestor chain, which may include inactive — deactivated but not
  // deleted — parents purely for inheritance purposes).
  const nodesById = new Map();
  for (const category of categories) {
    const chain = await getAncestorChain(category);
    const effective = mergeEffectiveRules(chain);
    nodesById.set(String(category._id), {
      category,
      effective: {
        ...effective,
        prohibitedKeywords: [...new Set([...globalKeywords, ...effective.prohibitedKeywords])],
        commissionRateBps: getEffectiveCommissionBps(category, seller),
      },
      children: [],
    });
  }

  const roots = [];
  for (const category of categories) {
    const node = nodesById.get(String(category._id));
    const parentId = category.parentId && String(category.parentId);
    // A still-active category whose parent is inactive/missing surfaces
    // as a root rather than disappearing — the parent being hidden from
    // new listings doesn't mean its active children should vanish too.
    if (parentId && activeIds.has(parentId)) {
      nodesById.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (nodes) => {
    nodes.sort((a, b) => a.category.sortOrder - b.category.sortOrder);
    nodes.forEach((n) => sortTree(n.children));
    return nodes;
  };

  res.json({ tree: sortTree(roots) });
};

module.exports = { getSellerCategoryTree };
