const Category = require('../models/Category');
const VehicleMake = require('../models/VehicleMake');

// GET /api/public/catalog/categories — active categories, names/slugs/
// icons only. No commission, no return/regulated/review rules, no
// prohibitedKeywords — those are internal to Apexora and sellers, never
// shown to shoppers.
const getPublicCategoryTree = async (req, res) => {
  const categories = await Category.find({ active: true }).select('name slug icon parentId sortOrder');
  const byId = new Map(categories.map((c) => [String(c._id), { id: c._id, name: c.name, slug: c.slug, icon: c.icon, sortOrder: c.sortOrder, children: [] }]));
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

// GET /api/public/vehicles — active makes, active models only.
const getPublicVehicles = async (req, res) => {
  const makes = await VehicleMake.find({ active: true }).select('name type models').sort({ name: 1 });
  const result = makes.map((m) => ({
    id: m._id,
    name: m.name,
    type: m.type,
    models: m.models.filter((model) => model.active).map((model) => ({ id: model._id, name: model.name, yearFrom: model.yearFrom, yearTo: model.yearTo })),
  }));
  res.json({ makes: result });
};

module.exports = { getPublicCategoryTree, getPublicVehicles };
