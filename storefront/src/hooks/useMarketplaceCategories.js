import { useState, useEffect } from 'react';
import { getCategoryTree } from '../api/marketplaceServices';

// Shared by StoreLayout (nav dropdown) and Footer (Quick Shop links) —
// both need the real category tree in marketplace mode, and without a
// shared cache each would fetch it independently on every single page
// (Footer and StoreLayout both mount on every route). A plain
// module-level cache, same pattern as StoreLayout's own original
// marketplaceCategoriesCache before this was extracted (follow-up #5:
// the footer's quick-shop links needed real category slugs too, not
// just the nav).
let cache = null;
let inFlight = null;

export default function useMarketplaceCategories() {
  const [categories, setCategories] = useState(cache || []);

  useEffect(() => {
    if (cache) return;
    inFlight = inFlight || getCategoryTree();
    inFlight.then(({ data }) => {
      cache = data.tree || [];
      setCategories(cache);
    }).catch(() => {});
  }, []);

  return categories;
}
