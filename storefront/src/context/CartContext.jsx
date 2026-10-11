import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  // CartProvider is a regular component (not a hook/util file), so this
  // works the same as in any other component — addToCart/updateQty below
  // are closures defined in this same render, so they see the current `t`.
  const { t } = useTranslation('cart');
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('storefrontCart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('storefrontCart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) {
      toast.error(t('toast.outOfStock'));
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i._id === product._id);
      if (existing) {
        if (existing.qty >= product.stock_quantity) {
          toast.error(t('toast.maxStockReached'));
          return prev;
        }
        return prev.map(i => i._id === product._id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    toast((toastObj) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px' }}>{t('addedToast.message', { name: product.name })}</span>
        <button
          onClick={() => { setIsCartOpen(true); toast.dismiss(toastObj.id); }}
          style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
        >
          {t('addedToast.viewCart')}
        </button>
      </div>
    ));
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i._id === id) {
        const newQty = i.qty + delta;
        if (newQty > i.stock_quantity) {
          toast.error(t('toast.notEnoughStock'));
          return i;
        }
        if (newQty < 1) return i;
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i._id !== id));

  const clearCart = () => setCart([]);

  const totalAmount = cart.reduce((sum, item) => sum + (item.selling_price * item.qty), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      updateQty,
      removeFromCart,
      clearCart,
      totalAmount,
      cartCount,
      isCartOpen,
      setIsCartOpen
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
