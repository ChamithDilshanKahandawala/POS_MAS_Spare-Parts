import { ShoppingCart } from 'lucide-react';
import { cartStrings } from '../../strings/cartStrings';

// size="sm" for the drawer, "lg" for the full /cart page.
export default function EmptyCart({ size = 'sm', onAction }) {
  const large = size === 'lg';
  return (
    <div style={{
      textAlign: 'center', color: 'var(--text-muted)',
      padding: large ? '80px 24px' : '60px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    }}>
      <div style={{
        width: large ? '84px' : '64px', height: large ? '84px' : '64px',
        borderRadius: '999px', background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '14px',
      }}>
        <ShoppingCart size={large ? 36 : 28} style={{ opacity: 0.35 }} />
      </div>
      <p style={{ fontWeight: 700, fontSize: large ? '18px' : '15px', color: 'var(--text-primary)' }}>
        {cartStrings.empty.title}
      </p>
      <p style={{ fontSize: large ? '14px' : '13px', marginBottom: '20px' }}>
        {cartStrings.empty.subtitle}
      </p>
      <button className="btn-primary" onClick={onAction} style={{ padding: large ? '12px 28px' : '10px 22px' }}>
        {cartStrings.empty.cta}
      </button>
    </div>
  );
}
