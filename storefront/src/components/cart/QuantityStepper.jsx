import { Minus, Plus } from 'lucide-react';
// `motion` is used via the <motion.span> member expression below; see the
// same note in CartDrawer.jsx.
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

// Pill-shaped qty stepper shared by the drawer (compact) and /cart page (full).
export default function QuantityStepper({ qty, min = 1, max, onIncrement, onDecrement, size = 'md' }) {
  const { t } = useTranslation('cart');
  const reducedMotion = usePrefersReducedMotion();
  const dim = size === 'sm' ? 26 : 30;
  const atMin = qty <= min;
  const atMax = typeof max === 'number' && qty >= max;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '2px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
        borderRadius: '999px', padding: '3px',
      }}
    >
      <button
        type="button"
        onClick={onDecrement}
        disabled={atMin}
        aria-label={t('item.decreaseQuantity')}
        style={{
          width: dim, height: dim, borderRadius: '999px', border: 'none',
          background: 'var(--bg-card)', color: atMin ? 'var(--text-muted)' : 'var(--text-primary)',
          cursor: atMin ? 'not-allowed' : 'pointer', opacity: atMin ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s ease',
        }}
        onMouseDown={(e) => { if (!atMin) e.currentTarget.style.transform = 'scale(0.9)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <Minus size={size === 'sm' ? 12 : 14} />
      </button>

      <span
        style={{
          minWidth: size === 'sm' ? '20px' : '24px', textAlign: 'center',
          fontSize: size === 'sm' ? '13px' : '14px', fontWeight: 700,
          fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)',
          display: 'inline-flex', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        {reducedMotion ? (
          qty
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={qty}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'inline-block' }}
            >
              {qty}
            </motion.span>
          </AnimatePresence>
        )}
      </span>

      <button
        type="button"
        onClick={onIncrement}
        disabled={atMax}
        aria-label={t('item.increaseQuantity')}
        title={atMax ? t('item.maxStockReached') : undefined}
        style={{
          width: dim, height: dim, borderRadius: '999px', border: 'none',
          background: 'var(--bg-card)', color: atMax ? 'var(--text-muted)' : 'var(--text-primary)',
          cursor: atMax ? 'not-allowed' : 'pointer', opacity: atMax ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s ease',
        }}
        onMouseDown={(e) => { if (!atMax) e.currentTarget.style.transform = 'scale(0.9)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <Plus size={size === 'sm' ? 12 : 14} />
      </button>
    </div>
  );
}
