import { ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import { formatLKR } from '../../utils/formatLKR';
import { cartStrings } from '../../strings/cartStrings';
import { FREE_DELIVERY_THRESHOLD } from '../../config/store';

export default function OrderSummary({ itemCount, subtotal, onCheckout, onContinueShopping, disableCheckout, disableReason }) {
  const remaining = FREE_DELIVERY_THRESHOLD != null ? Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal) : 0;
  const progressPct = FREE_DELIVERY_THRESHOLD != null
    ? Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)
    : 0;

  return (
    <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '18px' }}>
        {cartStrings.page.title} {'·'} {cartStrings.page.itemCount(itemCount)}
      </h2>

      {FREE_DELIVERY_THRESHOLD != null && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ height: '6px', borderRadius: '999px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`, borderRadius: '999px',
              background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <p style={{ fontSize: '12px', color: remaining === 0 ? 'var(--accent-green)' : 'var(--text-muted)', marginTop: '8px', fontWeight: 600 }}>
            {remaining === 0 ? cartStrings.summary.freeDeliveryUnlocked : cartStrings.summary.freeDeliveryProgress(formatLKR(remaining))}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>{cartStrings.summary.subtotal}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatLKR(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>{cartStrings.summary.delivery}</span>
          <span style={{ color: 'var(--text-muted)' }}>{cartStrings.summary.deliveryCalculated}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{cartStrings.summary.total}</span>
        <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatLKR(subtotal)}</span>
      </div>

      {/* Future: promo-code input goes here (not built yet) */}
      {/* Future: "or 3 × Rs. X" instalment line goes here (not built yet) */}

      <button
        className="btn-primary"
        onClick={onCheckout}
        disabled={disableCheckout}
        style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px', borderRadius: '14px', opacity: disableCheckout ? 0.5 : 1, cursor: disableCheckout ? 'not-allowed' : 'pointer' }}
      >
        <ShieldCheck size={18} /> {cartStrings.summary.proceedToCheckout}
      </button>
      {disableCheckout && disableReason && (
        <p style={{ fontSize: '12px', color: 'var(--accent-red)', textAlign: 'center', marginTop: '10px', fontWeight: 600 }}>
          {disableReason}
        </p>
      )}
      <button
        onClick={onContinueShopping}
        style={{ width: '100%', textAlign: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '14px', padding: '6px' }}
      >
        {cartStrings.summary.continueShopping}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
        {[
          { Icon: ShieldCheck, label: cartStrings.trust.cod },
          { Icon: Truck, label: cartStrings.trust.delivery },
          { Icon: RotateCcw, label: cartStrings.trust.returns },
          // `Icon` is used as <Icon/> below; this eslint config (no eslint-plugin-react)
          // doesn't trace a destructured, capitalized param's JSX usage inside .map().
          // eslint-disable-next-line no-unused-vars
        ].map(({ Icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Icon size={14} color="var(--accent-primary)" /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}
