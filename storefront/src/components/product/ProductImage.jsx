import { Package } from 'lucide-react';

// Shared image slot for product cards and the detail page. No product in
// this database currently has an `image`/`images` field (confirmed against
// backend/models/Product.js) — this always renders the placeholder today,
// but is wired up so real images need no redesign later.
// `size`: a pixel number for a fixed square (card thumbnails), or omitted
// to fill 100% of the parent width at a 1:1 aspect ratio (detail page).
// `children`: optional absolutely-positioned overlay content (badges, etc).
export default function ProductImage({ product, size, iconSize, style, className, children }) {
  const src = product?.images?.[0] || product?.image;
  const resolvedIconSize = iconSize || (typeof size === 'number' ? Math.round(size * 0.3) : 48);

  return (
    <div
      className={className}
      style={{
        width: typeof size === 'number' ? `${size}px` : '100%',
        aspectRatio: '1 / 1',
        background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
        ...style,
      }}
    >
      {src ? (
        <img
          src={src} alt={product?.name || ''} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Package size={resolvedIconSize} color="var(--text-muted)" style={{ opacity: 0.15 }} />
      )}
      {children}
    </div>
  );
}
