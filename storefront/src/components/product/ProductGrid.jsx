import { Package } from 'lucide-react';
import ProductCard from './ProductCard';
import { productStrings } from '../../strings/productStrings';

// Grid + loading skeleton + empty state, shared by StorefrontPage and
// anywhere else a product grid is needed.
export default function ProductGrid({ products, loading, liveUpdatedIds, onCardClick, onAddToCart, columns }) {
  const gridStyle = { display: 'grid', gridTemplateColumns: columns || 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' };

  if (loading) {
    return (
      <div style={gridStyle}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{
            height: '260px', background: 'var(--bg-card)', borderRadius: '16px',
            border: '1px solid var(--border-light)',
            backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
          }} />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        <Package size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} />
        <p style={{ fontWeight: 600, fontSize: '15px' }}>{productStrings.grid.empty}</p>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>{productStrings.grid.emptyHint}</p>
      </div>
    );
  }

  return (
    <div style={{ ...gridStyle, paddingBottom: '40px' }}>
      {products.map((p, idx) => (
        <ProductCard
          key={p._id}
          product={p}
          index={idx}
          isLiveUpdated={liveUpdatedIds?.has(p._id)}
          onCardClick={onCardClick ? () => onCardClick(p) : undefined}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}
