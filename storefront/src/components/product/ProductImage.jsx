// Shared image slot for product cards and the detail page. No product in
// this database currently has an `image`/`images` field (confirmed against
// backend/models/Product.js) — this always renders the placeholder today,
// but is wired up so real images need no redesign later.
// `size`: a pixel number for a fixed square (card thumbnails), or omitted
// to fill 100% of the parent width at a 1:1 aspect ratio (detail page).
// `children`: optional absolutely-positioned overlay content (badges, etc).
// `priority`: true for the first visible image on a page (e.g. the main
// product-detail photo) — renders eager + fetchPriority="high" instead of
// the lazy default, so it isn't held back behind everything else once real
// images exist. `srcSet`/`sizes` pass straight through to the <img> — no
// product in this database has more than one image URL today (confirmed
// against backend/models/Product.js), so there's nothing to generate them
// from yet, but a caller that does have size variants can hand them in
// without this component needing to change.
//
// Design refresh — the placeholder dropped the literal "Package" icon
// (reads as a cartoon on an otherwise premium page) for the shared
// .image-placeholder class instead: a soft diagonal sheen on the theme's
// own surface tones, no icon at all. Calmer, and it already matches
// whatever theme/direction index.css is set to without this component
// needing to know.
export default function ProductImage({ product, size, style, className, children, priority = false, srcSet, sizes }) {
  const src = product?.images?.[0] || product?.image;
  // Intrinsic width/height hint for the browser's layout engine (avoids a
  // reflow once a real image decodes in) — the wrapper's own aspectRatio:
  // '1/1' is what actually reserves the visible space either way.
  const dimension = typeof size === 'number' ? size : 400;

  return (
    <div
      className={`${src ? '' : 'image-placeholder'} ${className || ''}`.trim()}
      style={{
        width: typeof size === 'number' ? `${size}px` : '100%',
        aspectRatio: '1 / 1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
        ...(src ? { background: 'var(--bg-secondary)' } : {}),
        ...style,
      }}
    >
      {src && (
        <img
          src={src} alt={product?.name || ''}
          width={dimension} height={dimension}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          srcSet={srcSet} sizes={sizes}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {children}
    </div>
  );
}
