import { useEffect, useState } from 'react';

// Extracted from StorefrontPage's inline socket listener (same
// 'stock_updated' event, same payload shape) so the cart drawer/page can
// show live stock without duplicating that wiring. Returns a plain
// { [productId]: latestQuantity } map — callers fall back to the cart
// item's own stock_quantity when a product isn't in the map yet.
//
// socket.io-client is dynamically imported (see the same note in
// StorefrontPage.jsx) — this hook's callers (CartDrawer, CartPage) are
// already lazy-loaded routes/components, so this is mostly belt-and-
// suspenders, but keeps the import out of any future eager caller too.
export default function useLiveStock() {
  const [stockMap, setStockMap] = useState({});

  useEffect(() => {
    let socket;
    let cancelled = false;
    import('socket.io-client').then(({ io }) => {
      if (cancelled) return;
      socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
        transports: ['websocket', 'polling'],
      });

      socket.on('stock_updated', (updates) => {
        setStockMap((prev) => {
          const next = { ...prev };
          updates.forEach((u) => { next[u.productId] = u.newQuantity; });
          return next;
        });
      });
    });

    return () => { cancelled = true; socket?.disconnect(); };
  }, []);

  return stockMap;
}
