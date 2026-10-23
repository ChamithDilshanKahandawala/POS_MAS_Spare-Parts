import { buildMediaUrl } from './marketplaceServices';
import { getSellerForProduct } from '../config/store';

// Picks the active-language value out of a { en, si, ta } localized
// field, falling back to English, then to whatever isn't empty — never
// returns an empty string to a UI if ANY language has real content.
export function localizedPick(field, lang) {
  if (!field) return '';
  return field[lang] || field.en || Object.values(field).find(Boolean) || '';
}

// Maps a marketplace listing (controllers/publicListingsController.js's
// shape) onto the SAME product shape every existing storefront component
// already consumes (backend/models/Product.js's shape, as read through
// src/api/services.js's getProducts/getProductById) — so ProductCard,
// ProductGrid, ProductImage, CartContext, CheckoutPage etc. need zero
// changes to render a marketplace listing. Marketplace-only data that has
// no POS equivalent (fitment, attributes, seller, condition, warranty...)
// rides along under `__`-prefixed keys, which pos-mode components simply
// never read and marketplace-only components (product detail's fitment
// table, the seller card) read explicitly.
//
// stock_quantity: the public API deliberately exposes only a boolean
// `inStock` (never the real count — see services/listingPublicView.js),
// so there's no real number to report here. 99 is a generous stand-in
// just for the qty stepper's upper bound; it is fine to leave as-is for
// now because there is no overselling risk today — marketplace mode's
// checkout is still the Part A "coming soon" message, never a real
// order. Follow-up #6 (no change needed yet, action required before
// shipping): Milestone 6's real checkout MUST re-check actual stock on
// the server at order time (not trust this 99 or the client's cart
// quantity) and show the customer a clear "not enough stock" message
// if the seller doesn't have enough — the stepper's cap here is a UI
// nicety only, never the source of truth.
export function normalizeListing(listing, { lang = 'en', categoryName = '' } = {}) {
  return {
    _id: listing.id,
    name: localizedPick(listing.title, lang),
    sku_code: listing.sku || '',
    barcode: '',
    brand: listing.brand || '',
    category: categoryName,
    sub_category: '',
    unit: '',
    selling_price: Math.round((listing.priceCents || 0) / 100),
    stock_quantity: listing.inStock ? 99 : 0,
    low_stock_threshold: 0,
    description: localizedPick(listing.description, lang),
    tags: [],
    is_active: true,
    images: (listing.images || []).map((id) => buildMediaUrl(id, 'medium', 'webp')),

    __wasPriceCents: listing.wasPriceCents,
    __condition: listing.condition,
    __attributes: listing.attributes || {},
    __fitment: listing.fitment || [],
    __warranty: listing.warranty,
    __dimensions: listing.dimensions,
    __weightGrams: listing.weightGrams,
    __categoryId: listing.categoryId,
    __seller: listing.seller?.slug
      ? { id: listing.seller.id, name: listing.seller.displayName || listing.seller.name, slug: listing.seller.slug, district: listing.seller.district }
      : null,
  };
}

// Used by CartPage/CheckoutPage to group line items by seller regardless
// of mode: a marketplace-normalized item carries its own real seller
// (__seller), a plain POS-shaped item has none, so it falls back to
// config/store.js's single hardcoded seller exactly as both pages already
// did before this milestone.
export function getItemSeller(item) {
  return item.__seller || getSellerForProduct(item);
}

// A listing's fitment range reads as "fits <make> <model> <yearFrom>-<yearTo>"
// (open-ended ranges render with an en dash to "now"/"earlier" instead of
// a raw null). Used by the fitment table + "Fits your vehicle" badge.
export function fitmentRangeLabel(entry, makeName) {
  const model = entry.modelName || '';
  const parts = [makeName, model].filter(Boolean).join(' ');
  if (!entry.yearFrom && !entry.yearTo) return parts;
  const from = entry.yearFrom ?? '—';
  const to = entry.yearTo ?? 'now';
  return `${parts} (${from}–${to})`;
}

// Whether ANY of a listing's fitment ranges includes the given vehicle
// (by makeId + modelName, year optional). Mirrors the backend's own
// fitment filter logic (controllers/publicListingsController.js) so the
// "Fits your vehicle" badge agrees with what the fitment filter itself
// would return.
export function listingFitsVehicle(fitment, vehicle) {
  if (!vehicle || !fitment?.length) return false;
  return fitment.some((entry) => {
    if (String(entry.makeId) !== String(vehicle.makeId)) return false;
    if (vehicle.modelName && entry.modelName && entry.modelName !== vehicle.modelName) return false;
    if (vehicle.year) {
      if (entry.yearFrom && vehicle.year < entry.yearFrom) return false;
      if (entry.yearTo && vehicle.year > entry.yearTo) return false;
    }
    return true;
  });
}
