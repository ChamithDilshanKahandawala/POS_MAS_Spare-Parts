import { Link } from 'react-router-dom';
import { Package, Trash2 } from 'lucide-react';
import QuantityStepper from './QuantityStepper';
import { formatLKR } from '../../utils/formatLKR';
import { cartStrings } from '../../strings/cartStrings';

// variant: "compact" (drawer) | "full" (/cart page)
export default function CartLineItem({ item, variant = 'compact', liveStock, onIncrement, onDecrement, onRemove }) {
  const full = variant === 'full';
  const thumbSize = full ? 76 : 50;
  const image = item.image || item.images?.[0];
  const knownStock = typeof liveStock === 'number' ? liveStock : item.stock_quantity;
  const outOfStock = knownStock === 0;
  const lowStock = !outOfStock && knownStock > 0 && knownStock < 5;

  const thumb = (
    <div style={{
      width: thumbSize, height: thumbSize, borderRadius: full ? '14px' : '10px',
      background: 'var(--accent-light)', border: '1px solid var(--border-light)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {image ? (
        <img
          src={image} alt={item.name} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '1 / 1' }}
        />
      ) : (
        <Package size={full ? 30 : 20} color="var(--accent-primary)" style={{ opacity: 0.5 }} />
      )}
    </div>
  );

  return (
    <div style={{
      display: 'flex', gap: full ? '16px' : '12px',
      padding: full ? '18px 0' : '12px',
      borderBottom: full ? '1px solid var(--border-light)' : 'none',
      background: full ? 'transparent' : 'var(--bg-secondary)',
      borderRadius: full ? 0 : '14px',
      opacity: outOfStock ? 0.75 : 1,
    }}>
      {full ? <Link to={`/product/${item._id}`} style={{ flexShrink: 0 }}>{thumb}</Link> : thumb}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{
            fontSize: full ? '14px' : '13px', fontWeight: 600, color: 'var(--text-primary)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            lineHeight: 1.35,
          }}>
            {item.name}
          </span>
          {full && (
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {formatLKR(item.selling_price * item.qty)}
            </span>
          )}
        </div>

        {full && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {item.category}
          </span>
        )}

        <span style={{ fontSize: full ? '13px' : '12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {formatLKR(item.selling_price)} {!full && `× ${item.qty}`}
        </span>

        {outOfStock ? (
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-red)' }}>
            {cartStrings.item.outOfStock}
          </span>
        ) : lowStock ? (
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-yellow)' }}>
            {cartStrings.item.lowStock(knownStock)}
          </span>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
          <QuantityStepper
            qty={item.qty}
            min={1}
            max={outOfStock ? 0 : knownStock}
            size={full ? 'md' : 'sm'}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${cartStrings.item.remove} ${item.name}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, padding: '4px',
            }}
          >
            <Trash2 size={14} />
            {full && cartStrings.item.remove}
          </button>
        </div>
      </div>

      {!full && (
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {formatLKR(item.selling_price * item.qty)}
        </div>
      )}
    </div>
  );
}
