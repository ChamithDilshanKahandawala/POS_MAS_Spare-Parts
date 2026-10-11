// Every user-facing string for /category/:slug, same pattern as
// cartStrings.js / productStrings.js.
export const categoryStrings = {
  breadcrumb: { home: 'Home' },
  productCount: (n) => `${n} product${n === 1 ? '' : 's'}`,
  toolbar: {
    sort: 'Sort',
    sortOptions: {
      featured: 'Featured',
      price_asc: 'Price: low to high',
      price_desc: 'Price: high to low',
      name_asc: 'Name A–Z',
    },
    inStockOnly: 'In stock only',
    brand: 'Brand',
    filters: 'Filters',
    clearAll: 'Clear all',
    applyFilters: 'Show results',
  },
  loadMore: 'Load more',
  empty: {
    title: 'No products match these filters',
    subtitle: 'Try removing a filter or two.',
    cta: 'Clear filters',
  },
  notFound: {
    title: 'Category not found',
    subtitle: "This category doesn't exist. Try one of these instead:",
  },
  error: {
    title: 'Something went wrong',
    subtitle: "We couldn't load this category. Check your connection and try again.",
  },
  actions: {
    backToShop: 'Back to shop',
    tryAgain: 'Try again',
  },
};
