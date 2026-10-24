// The customer-facing shape of a listing — used by the real public API
// (controllers/publicListingsController.js, Milestone 5's storefront)
// AND by the admin review detail page's "as a customer would see it"
// preview (controllers/adminListingsController.js), so both are
// guaranteed to show exactly the same fields a buyer would ever see.
// Never includes internal-only data: statusHistory, rejectionReasons,
// pendingRevision, seller private info, commission, categorySchemaVersion.
function toPublicListing(listing) {
  const images = (listing.images || []).map((img) => (img._id ? img._id : img));
  return {
    id: listing._id,
    title: listing.title,
    description: listing.description,
    categoryId: listing.categoryId,
    brand: listing.brand,
    sku: listing.sku,
    condition: listing.condition,
    attributes: listing.attributes,
    fitment: listing.fitment,
    images,
    priceCents: listing.priceCents,
    wasPriceCents: listing.wasPriceCents,
    // Milestone 6: `stock` alone is no longer "real availability" once
    // orders can reserve units against it (services/stockReservation.js)
    // — a listing with 1 unit of stock and 1 active reservation is sold
    // out to everyone else, even though `stock` itself still reads 1.
    inStock: Math.max(0, (listing.stock || 0) - (listing.reservedQty || 0)) > 0,
    weightGrams: listing.weightGrams,
    dimensions: listing.dimensions,
    warranty: listing.warranty,
    seller: listing.seller?.name
      ? {
        id: listing.seller._id,
        displayName: listing.seller.displayName || listing.seller.name,
        district: listing.seller.district,
        slug: listing.seller.slug || null,
      }
      : listing.seller,
  };
}

module.exports = { toPublicListing };
