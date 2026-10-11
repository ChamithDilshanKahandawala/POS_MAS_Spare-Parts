import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Extracted from StorefrontPage's inline socket listener (same
// 'stock_updated' event, same payload shape) so the cart drawer/page can
// show live stock without duplicating that wiring. Returns a plain
// { [productId]: latestQuantity } map — callers fall back to the cart
// item's own stock_quantity when a product isn't in the map yet.
export default function useLiveStock() {
  const [stockMap, setStockMap] = useState({});

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
      transports: ['websocket', 'polling'],
    });

    socket.on('stock_updated', (updates) => {
      setStockMap((prev) => {
        const next = { ...prev };
        updates.forEach((u) => { next[u.productId] = u.newQuantity; });
        return next;
      });
    });

    return () => socket.disconnect();
  }, []);

  return stockMap;
}
