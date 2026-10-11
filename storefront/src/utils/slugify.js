// Used for the category breadcrumb link (/category/:slug). The category
// page itself doesn't exist yet — App.jsx's catch-all route sends an
// unmatched path back to "/", so this link is safe to ship ahead of it.
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
