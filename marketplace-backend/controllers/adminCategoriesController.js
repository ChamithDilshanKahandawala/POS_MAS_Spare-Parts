const Category = require('../models/Category');
const { getEffectiveCategory, buildTree, MAX_DEPTH } = require('../services/categoryRules');
const { logAction } = require('../services/auditLog');
const { flagListingsForCategoryChange } = require('../services/listingDrift');

// GET /api/admin/catalog/categories — every category, active or not
// (admin needs to see and manage both), as a nested tree.
const getCategoryTree = async (req, res) => {
  const categories = await Category.find({});
  res.json({ tree: buildTree(categories) });
};

// GET /api/admin/catalog/categories/:id — the raw category plus its
// resolved (effective) rules, for the edit panel's live preview.
const getCategoryDetail = async (req, res) => {
  const result = await getEffectiveCategory(req.params.id);
  if (!result) return res.status(404).json({ message: 'Category not found' });
  res.json(result);
};

async function validateParentAndDepth(parentId, excludeId = null) {
  if (!parentId) return { depth: 0, error: null };
  if (excludeId && String(parentId) === String(excludeId)) {
    return { depth: null, error: 'A category cannot be its own parent' };
  }
  const parent = await Category.findById(parentId);
  if (!parent) return { depth: null, error: 'Parent category not found' };
  const depth = parent.depth + 1;
  if (depth > MAX_DEPTH) {
    return { depth: null, error: `Categories can be nested at most ${MAX_DEPTH + 1} levels deep` };
  }
  return { depth, error: null };
}

// POST /api/admin/catalog/categories
const createCategory = async (req, res) => {
  const { parentId, slug } = req.body;

  const { depth, error } = await validateParentAndDepth(parentId);
  if (error) return res.status(400).json({ message: error });

  const existing = await Category.findOne({ slug });
  if (existing) return res.status(409).json({ message: 'That slug is already in use' });

  const category = await Category.create({ ...req.body, parentId: parentId || null, depth });

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'category.create',
    targetType: 'Category',
    targetId: category._id,
    after: category.toObject(),
    summary: `Created category "${category.name.en}"`,
  });

  res.status(201).json({ category });
};

// PATCH /api/admin/catalog/categories/:id — restrictFieldsToOwner (route)
// already blocked commission/regulated/reviewRequired for non-owners
// before this ever runs. Slug and attribute-field-key renames are
// blocked outright (for anyone, owner included) once the category has
// listings — see the inline guards below.
const updateCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found' });

  const before = category.toObject();

  if (req.body.slug !== undefined && req.body.slug !== category.slug) {
    if (category.listingCount > 0) {
      return res.status(409).json({ message: 'Cannot rename the slug: this category has active listings' });
    }
    const dup = await Category.findOne({ slug: req.body.slug, _id: { $ne: category._id } });
    if (dup) return res.status(409).json({ message: 'That slug is already in use' });
  }

  let depth = category.depth;
  if (req.body.parentId !== undefined && String(req.body.parentId || '') !== String(category.parentId || '')) {
    const result = await validateParentAndDepth(req.body.parentId, category._id);
    if (result.error) return res.status(400).json({ message: result.error });
    depth = result.depth;
  }

  if (req.body.attributeSchema !== undefined && category.listingCount > 0) {
    const oldKeyById = new Map(category.attributeSchema.map((f) => [String(f._id), f.key]));
    for (const field of req.body.attributeSchema) {
      if (field._id && oldKeyById.has(String(field._id))) {
        const oldKey = oldKeyById.get(String(field._id));
        if (oldKey !== field.key) {
          return res.status(409).json({ message: `Cannot rename field key "${oldKey}": this category has active listings` });
        }
      }
    }
  }

  const bumpSchemaVersion = req.body.attributeSchema !== undefined;
  Object.assign(category, req.body, { depth });
  if (bumpSchemaVersion) category.schemaVersion += 1;
  await category.save();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'category.update',
    targetType: 'Category',
    targetId: category._id,
    before,
    after: category.toObject(),
    summary: `Updated category "${category.name.en}"`,
  });

  if (bumpSchemaVersion) await flagListingsForCategoryChange(category._id);

  res.json({ category });
};

// DELETE /api/admin/catalog/categories/:id — only when nothing
// references it and it has no subcategories; otherwise deactivate
// (PATCH active:false) instead.
const deleteCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found' });

  if (category.listingCount > 0) {
    return res.status(409).json({ message: 'Cannot delete: this category has active listings. Deactivate it instead.' });
  }
  const childCount = await Category.countDocuments({ parentId: category._id });
  if (childCount > 0) {
    return res.status(409).json({ message: 'Cannot delete: this category has subcategories.' });
  }

  await category.deleteOne();

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'category.delete',
    targetType: 'Category',
    targetId: category._id,
    before: category.toObject(),
    summary: `Deleted category "${category.name.en}"`,
  });

  res.json({ message: 'Deleted' });
};

// PATCH /api/admin/catalog/categories/reorder — drag-to-reorder within
// one parent. Every id must share the same parentId (never shown for a
// cross-parent drag by the UI, but still checked here since the UI's
// own rule is never the one actually enforcing it).
const reorderCategories = async (req, res) => {
  const { parentId, orderedIds } = req.body;

  const categories = await Category.find({ _id: { $in: orderedIds } });
  if (categories.length !== orderedIds.length) {
    return res.status(400).json({ message: 'One or more category ids were not found' });
  }
  if (categories.some((c) => String(c.parentId || '') !== String(parentId || ''))) {
    return res.status(400).json({ message: 'All categories being reordered must share the same parent' });
  }

  await Promise.all(orderedIds.map((id, index) => Category.updateOne({ _id: id }, { sortOrder: index })));

  await logAction({
    actor: req.user,
    actorRole: req.user.platformRole,
    action: 'category.reorder',
    targetType: 'Category',
    targetId: parentId || 'root',
    summary: `Reordered ${orderedIds.length} categories under ${parentId ? 'a parent category' : 'the root level'}`,
  });

  res.json({ message: 'Reordered' });
};

module.exports = {
  getCategoryTree,
  getCategoryDetail,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
};
