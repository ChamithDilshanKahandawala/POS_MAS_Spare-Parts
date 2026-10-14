import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Eye } from 'lucide-react';
import ProductImage from './ProductImage';
import { formatLKR } from '../../utils/formatLKR';
import { getSellerForProduct } from '../../config/store';

// Used on StorefrontPage's grid, the product detail page's "You may also
// like" row, and anywhere else a product tile is needed. `onCardClick`
// fires for a click anywhere on the card except the image/title links and
// the Add button (StorefrontPage uses it to open the quick-view modal;
// the detail page's related row uses it to also navigate, since there's no
// modal there).
export default function ProductCard({ product, index = 0, isLiveUpdated, onCardClick, onAddToCart }) {
  const { t } = useTranslation('product');
  const { t: tPlatform } = useTranslation('platform');
  const outOfStock = product.stock_quantity <= 0;
  const detailHref = `/product/${product._id}`;
  const seller = getSellerForProduct(product);

  return (
    <div
      className="product-card-enter"
      style={{
        background: 'var(--bg-card)', borderRadius: '16px',
        border: `1px solid ${isLiveUpdated ? '#27ae60' : 'var(--border-light)'}`,
        boxShadow: isLiveUpdated ? '0 0 0 3px rgba(39,174,96,0.15)' : 'var(--card-shadow)',
        display: 'flex', flexDirection: 'column', cursor: 'pointer',
        transition: 'all 0.3s ease', overflow: 'hidden',
        animationDelay: `${index * 0.04}s`,
      }}
      onClick={onCardClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
    >
      {/* Image area — links to the detail page; stopPropagation so it
          doesn't also fire onCardClick (quick-view, etc). */}
      <Link to={detailHref} onClick={(e) => e.stopPropagation()} style={{ display: 'block', borderBottom: '1px solid var(--border-light)' }}>
        <ProductImage product={product} style={{ height: '140px', width: '100%', borderRadius: 0 }}>
          {/* Stock badge overlay */}
          <span style={{
            position: 'absolute', top: '10px', left: '10px',
            fontSize: '10px', fontWeight: 700, padding: '4px 10px',
            borderRadius: '20px',
            background: product.stock_quantity > 10 ? 'rgba(39,174,96,0.12)' : product.stock_quantity > 0 ? 'rgba(243,156,18,0.12)' : 'rgba(231,76,60,0.12)',
            color: product.stock_quantity > 10 ? '#27ae60' : product.stock_quantity > 0 ? '#f39c12' : 'var(--badge-red-text)',
            border: `1px solid ${product.stock_quantity > 10 ? 'rgba(39,174,96,0.25)' : product.stock_quantity > 0 ? 'rgba(243,156,18,0.25)' : 'rgba(231,76,60,0.25)'}`,
          }}>
            {product.stock_quantity > 0 ? t('card.inStockCount', { count: product.stock_quantity }) : t('stock.outOfStock')}
          </span>
          {isLiveUpdated && (
            <span style={{
              position: 'absolute', top: '10px', right: '10px',
              fontSize: '9px', fontWeight: 700, color: '#27ae60',
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(39,174,96,0.1)', padding: '3px 8px',
              borderRadius: '12px', border: '1px solid rgba(39,174,96,0.2)',
            }}>
              <span style={{ width: '6px', height: '6px', background: '#27ae60', borderRadius: '50%', animation: 'pulse-glow 1s infinite' }} />
              {t('card.live')}
            </span>
          )}
          {/* Quick view overlay (desktop hover hint only — click still
              navigates via the wrapping Link) */}
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.03)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
          >
            <span style={{
              background: 'var(--accent-primary)', color: 'white',
              padding: '8px 16px', borderRadius: '8px', fontSize: '12px',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
            }}><Eye size={14} /> {t('card.quickView')}</span>
          </div>
        </ProductImage>
      </Link>

      {/* Card content */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-primary-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {product.category}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{product.sku_code}</span>
        </div>
        <Link to={detailHref} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: 1.3 }}>{product.name}</h3>
        </Link>
        <div style={{
          fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {tPlatform('soldBy', { seller: seller.name })}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary-text)' }}>
            {formatLKR(product.selling_price)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
            disabled={outOfStock}
            style={{
              padding: '8px 14px', borderRadius: '8px', fontSize: '12px',
              fontWeight: 700, cursor: outOfStock ? 'not-allowed' : 'pointer',
              border: 'none', display: 'flex', alignItems: 'center', gap: '5px',
              background: outOfStock ? 'var(--bg-secondary)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: outOfStock ? 'var(--text-muted)' : 'white',
              transition: 'all 0.2s',
            }}
          >
            <ShoppingCart size={13} /> {t('card.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
