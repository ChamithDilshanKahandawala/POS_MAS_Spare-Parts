import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import useIsMobile from '../hooks/useIsMobile';
import useLiveStock from '../hooks/useLiveStock';
import CartLineItem from '../components/cart/CartLineItem';
import OrderSummary from '../components/cart/OrderSummary';
import EmptyCart from '../components/cart/EmptyCart';
import { formatLKR } from '../utils/formatLKR';
import { useTranslation } from 'react-i18next';

export default function CartPage() {
  const { t } = useTranslation('cart');
  const { cart, updateQty, removeFromCart, addToCart, totalAmount } = useCart();
  const navigate = useNavigate();
  const isMobile = useIsMobile(1024);
  const liveStock = useLiveStock();
  // Remember full items (not just ids) so Undo can restore qty exactly.
  const removedItemsRef = useRef({});

  const handleRemove = (item) => {
    removedItemsRef.current[item._id] = item;
    removeFromCart(item._id);
    toast((toastObj) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px' }}>{t('removedToast.message', { name: item.name })}</span>
        <button
          onClick={() => {
            const removed = removedItemsRef.current[item._id];
            if (removed) {
              for (let i = 0; i < removed.qty; i += 1) addToCart(removed);
            }
            toast.dismiss(toastObj.id);
          }}
          style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
        >
          {t('removedToast.undo')}
        </button>
      </div>
    ), { duration: 5000 });
  };

  const anyOutOfStock = cart.some((item) => {
    const stock = typeof liveStock[item._id] === 'number' ? liveStock[item._id] : item.stock_quantity;
    return stock === 0;
  });

  const handleCheckout = () => navigate('/checkout');

  if (cart.length === 0) {
    return (
      <div className="animate-fade">
        <EmptyCart size="lg" onAction={() => navigate('/')} />
      </div>
    );
  }

  return (
    <>
    <div className="animate-fade" style={{ paddingBottom: isMobile ? '110px' : '40px' }}>
      <button
        onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '20px', fontSize: '14px', fontWeight: 600 }}
      >
        <ArrowLeft size={16} /> {t('summary.continueShopping')}
      </button>

      <h1 className="page-title" style={{ marginBottom: '24px' }}>{t('page.title')}</h1>

      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        {/* Line items */}
        <div style={{ flex: isMobile ? '1 1 100%' : '2 1 0%', minWidth: 0 }}>
          <div className="glass-card" style={{ padding: '8px 20px', borderRadius: '20px' }}>
            {cart.map((item) => (
              <CartLineItem
                key={item._id}
                item={item}
                variant="full"
                liveStock={liveStock[item._id]}
                onIncrement={() => updateQty(item._id, 1)}
                onDecrement={() => updateQty(item._id, -1)}
                onRemove={() => handleRemove(item)}
              />
            ))}
          </div>
        </div>

        {/* Order summary */}
        <div style={{ flex: isMobile ? '1 1 100%' : '1 1 0%', minWidth: 0, position: isMobile ? 'static' : 'sticky', top: '24px' }}>
          <OrderSummary
            itemCount={cart.reduce((n, i) => n + i.qty, 0)}
            subtotal={totalAmount}
            onCheckout={handleCheckout}
            onContinueShopping={() => navigate('/')}
            disableCheckout={anyOutOfStock}
            disableReason={anyOutOfStock ? t('summary.blockedByStock') : null}
          />
        </div>
      </div>
    </div>

      {/* Mobile sticky checkout bar — rendered as a sibling of the .animate-fade
          div above, not inside it: a CSS animation leaves `transform` on the
          element even after it finishes (fill-mode: forwards), which creates a
          new containing block for position:fixed descendants and would pin
          this bar to the bottom of that div instead of the viewport. */}
      {isMobile && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
          background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(14px)',
          borderTop: '1px solid var(--border-light)',
          padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('summary.total')}</div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatLKR(totalAmount)}</div>
          </div>
          <button
            className="btn-primary"
            onClick={handleCheckout}
            disabled={anyOutOfStock}
            style={{ padding: '12px 22px', borderRadius: '14px', opacity: anyOutOfStock ? 0.5 : 1, cursor: anyOutOfStock ? 'not-allowed' : 'pointer' }}
          >
            <ShieldCheck size={16} /> {t('summary.proceedToCheckout')}
          </button>
        </div>
      )}
    </>
  );
}
