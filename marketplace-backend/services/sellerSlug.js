const Seller = require('../models/Seller');

function slugify(name) {
  return (name || 'store')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'store';
}

// Milestone 3's public store page needs a stable, URL-safe handle per
// seller. Appends -2, -3, ... on collision rather than failing — store
// names aren't unique (M1A never required it), slugs must be.
async function generateUniqueSlug(name, excludeSellerId = null) {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  for (;;) {
    const query = { slug: candidate };
    if (excludeSellerId) query._id = { $ne: excludeSellerId };
    const existing = await Seller.findOne(query).select('_id');
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }
}

module.exports = { slugify, generateUniqueSlug };
