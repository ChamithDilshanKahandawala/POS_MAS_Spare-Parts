// Every user-facing string for the product grid + product detail page lives
// here, same pattern as cartStrings.js.
export const productStrings = {
  grid: {
    empty: 'No products found.',
    emptyHint: 'Try adjusting your search or category filter.',
  },
  card: {
    quickView: 'Quick View',
  },
  breadcrumb: {
    home: 'Home',
  },
  stock: {
    inStock: 'In stock',
    lowStock: (n) => `Only ${n} left`,
    outOfStock: 'Out of stock',
  },
  actions: {
    addToCart: 'Add to cart',
    buyNow: 'Buy now',
    whatsapp: 'Order on WhatsApp',
    backToShop: 'Back to shop',
    tryAgain: 'Try again',
    viewFullDetails: 'View full details →',
  },
  sections: {
    specifications: 'Specifications',
    compatibility: 'Vehicle Compatibility',
    description: 'Description',
    showMore: 'Show more',
    showLess: 'Show less',
    relatedTitle: 'You may also like',
  },
  specs: {
    brand: 'Brand',
    partNumber: 'Part Number (SKU)',
    category: 'Category',
    subCategory: 'Sub-category',
    barcode: 'Barcode',
    unit: 'Unit',
  },
  notFound: {
    title: 'Product not found',
    subtitle: "This product doesn't exist or may have been removed.",
  },
  error: {
    title: 'Something went wrong',
    subtitle: "We couldn't load this product. Check your connection and try again.",
  },
  whatsappMessage: (product, qty) =>
    `Hi! I'm interested in: ${product.name} (SKU: ${product.sku_code}) — Qty: ${qty} — Rs. ${Number(product.selling_price * qty).toLocaleString()}`,
};
