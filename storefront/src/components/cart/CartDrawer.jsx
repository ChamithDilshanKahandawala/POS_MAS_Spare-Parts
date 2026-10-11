import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// `motion` is used via the <motion.div> member expression below; this project's
// flat eslint config has no eslint-plugin-react, so no-unused-vars can't see
// JSX member-expression usage (only direct <Identifier> tags).
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingCart, ShieldCheck } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import useIsMobile from '../../hooks/useIsMobile';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import useLiveStock from '../../hooks/useLiveStock';
import CartLineItem from './CartLineItem';
import EmptyCart from './EmptyCart';
import { formatLKR } from '../../utils/formatLKR';
import { useTranslation } from 'react-i18next';

export default function CartDrawer() {
  const { t } = useTranslation('cart');
  const { cart, updateQty, removeFromCart, totalAmount, isCartOpen, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const isMobile = useIsMobile(640);
  const reducedMotion = usePrefersReducedMotion();
  const liveStock = useLiveStock();

  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const closeBtnRef = useRef(null);

  const close = () => setIsCartOpen(false);

  // Focus trap + Esc to close + body scroll lock, while open.
  useEffect(() => {
    if (!isCartOpen) return;

    previouslyFocused.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = () => closeBtnRef.current?.focus();
    const raf = requestAnimationFrame(focusFirst);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCartOpen]);

  // CheckoutPage itself prompts for login when `user` is absent, so this can
  // always navigate straight there.
  const handleCheckout = () => {
    close();
    navigate('/checkout');
  };

  const panelTransition = reducedMotion
    ? { duration: 0.15 }
    : { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 };

  const panelVariants = isMobile
    ? {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
      }
    : {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
      };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
            }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            initial={panelVariants.initial}
            animate={panelVariants.animate}
            exit={panelVariants.exit}
            transition={panelTransition}
            style={isMobile ? {
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001,
              maxHeight: '85vh', background: 'var(--bg-card)',
              borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
            } : {
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1001,
              width: '420px', maxWidth: '100vw', background: 'var(--bg-card)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
            }}
          >
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '999px', background: 'var(--border)' }} />
              </div>
            )}

            {/* Header */}
            <div style={{
              padding: isMobile ? '12px 20px 16px' : '20px 24px',
              borderBottom: '1px solid var(--border-light)',
              background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(14px)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 id="cart-drawer-title" style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <ShoppingCart size={19} color="var(--accent-primary)" /> {t('drawer.title')}
                <span style={{
                  fontSize: '11px', fontWeight: 700, background: 'var(--accent-light)',
                  color: 'var(--accent-primary)', padding: '2px 9px', borderRadius: '999px',
                }}>{cart.length}</span>
              </h2>
              <button
                ref={closeBtnRef}
                onClick={close}
                aria-label={t('drawer.closeCart')}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                  borderRadius: '10px', width: '34px', height: '34px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: cart.length ? '14px 16px' : 0 }}>
              {cart.length === 0 ? (
                <EmptyCart size="sm" onAction={() => { close(); navigate('/'); }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <AnimatePresence initial={false}>
                    {cart.map((item) => (
                      <motion.div
                        key={item._id}
                        layout={!reducedMotion}
                        initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <CartLineItem
                          item={item}
                          variant="compact"
                          liveStock={liveStock[item._id]}
                          onIncrement={() => updateQty(item._id, 1)}
                          onDecrement={() => updateQty(item._id, -1)}
                          onRemove={() => removeFromCart(item._id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div style={{
                padding: '18px 20px', paddingBottom: isMobile ? 'calc(18px + env(safe-area-inset-bottom))' : '18px',
                borderTop: '1px solid var(--border-light)',
                background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(14px)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '17px', fontWeight: 800 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{t('summary.total')}</span>
                  <span style={{ color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatLKR(totalAmount)}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>{t('drawer.deliveryNote')}</div>
                <button
                  className="btn-primary"
                  onClick={handleCheckout}
                  style={{ width: '100%', padding: '13px', borderRadius: '14px', fontSize: '14px', justifyContent: 'center', marginBottom: '8px' }}
                >
                  <ShieldCheck size={16} /> {t('drawer.checkout')}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => { close(); navigate('/cart'); }}
                  style={{ width: '100%', padding: '11px', borderRadius: '14px', fontSize: '13px', justifyContent: 'center' }}
                >
                  {t('drawer.viewFullCart')}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
