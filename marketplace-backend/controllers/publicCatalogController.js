const Category = require('../models/Category');
const VehicleMake = require('../models/VehicleMake');
const cache = require('../services/cache');

// GET /api/public/catalog/categories — active categories, names/slugs/
// icons, PLUS returnPolicy/warrantyRule (Milestone 5: the storefront's
// product detail page shows "Returnable within N days"/minimum warranty
// straight from this). Still no commission, no regulated/reviewRequired,
// no prohibitedKeywords — those stay internal to Apexora and sellers,
// never shown to shoppers; returnPolicy/warrantyRule are themselves
// customer-facing policy text, not internal rules, so they're the one
// exception. Cached — this is read on nearly every page/wizard step and
// categories change rarely; invalidated by every category write
// (adminCategoriesController.js).
const getPublicCategoryTree = async (req, res) => {
  let categories = cache.get('category:active:public');
  if (!categories) {
    categories = await Category.find({ active: true }).select('name slug icon parentId sortOrder returnPolicy warrantyRule').lean();
    cache.set('category:active:public', categories);
  }
  const byId = new Map(categories.map((c) => [String(c._id), {
    id: c._id, name: c.name, slug: c.slug, icon: c.icon, sortOrder: c.sortOrder,
    returnPolicy: c.returnPolicy, warrantyRule: c.warrantyRule, children: [],
  }]));
  const activeIds = new Set(byId.keys());

  const roots = [];
  for (const category of categories) {
    const node = byId.get(String(category._id));
    const parentId = category.parentId && String(category.parentId);
    if (parentId && activeIds.has(parentId)) byId.get(parentId).children.push(node);
    else roots.push(node);
  }

  const sortTree = (nodes) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortTree(n.children));
    return nodes;
  };

  res.json({ tree: sortTree(roots) });
};

// GET /api/public/vehicles — active makes, active models only. Cached —
// read on every fitment-category wizard step; invalidated by every
// vehicle make write (adminVehiclesController.js).
const getPublicVehicles = async (req, res) => {
  let makes = cache.get('vehicleMake:active');
  if (!makes) {
    makes = await VehicleMake.find({ active: true }).select('name type models').sort({ name: 1 }).lean();
    cache.set('vehicleMake:active', makes);
  }
  const result = makes.map((m) => ({
    id: m._id,
    name: m.name,
    type: m.type,
    models: m.models.filter((model) => model.active).map((model) => ({ id: model._id, name: model.name, yearFrom: model.yearFrom, yearTo: model.yearTo })),
  }));
  res.json({ makes: result });
};

module.exports = { getPublicCategoryTree, getPublicVehicles };
