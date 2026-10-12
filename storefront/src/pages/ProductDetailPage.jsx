import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronRight, ShoppingCart, ShieldCheck, Truck, RotateCcw,
  MessageCircle, Package, AlertTriangle,
} from 'lucide-react';
import { getProductById, getProducts } from '../api/services';
import { useCart } from '../context/CartContext';
import useLiveStock from '../hooks/useLiveStock';
import useIsMobile from '../hooks/useIsMobile';
import QuantityStepper from '../components/cart/QuantityStepper';
import ProductImage from '../components/product/ProductImage';
import ProductCard from '../components/product/ProductCard';
import { formatLKR } from '../utils/formatLKR';
import { slugify } from '../utils/slugify';
import { useTranslation } from 'react-i18next';
import { WHATSAPP_NUMBER, SHOP_INFO } from '../config/store';

const DEFAULT_TITLE = `${SHOP_INFO.name} · Genuine Vehicle Spare Parts`;

function SkeletonBlock({ height }) {
  return (
    <div style={{
      height, borderRadius: '10px', background: 'var(--bg-card)',
      backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  );
}

export default function ProductDetailPage() {
  const { t } = useTranslation('product');
  const { t: tCart } = useTranslation('cart');
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile(1024);
  const { addToCart } = useCart();
  const liveStock = useLiveStock();

  const [product, setProduct] = useState(null);
  const [loadStatus, setLoadStatus] = useState('loading'); // loading | ready | notfound | error
  const [retryKey, setRetryKey] = useState(0);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [related, setRelated] = useState([]);

  // Fetch the product. The route renders this component with key={id} (see
  // App.jsx) so every field above starts fresh on its own initial value
  // whenever the id changes — no manual reset needed here, which keeps this
  // effect limited to "fetch, then setState from the result", not a
  // synchronous reset followed by an async update.
  // A malformed id never hits the clean 404 path — Mongoose throws a
  // CastError that the backend's catch-all turns into a 500 with a
  // "Cast to ObjectId failed..." message (see Step 0 finding #2) — treated
  // the same as a 404 here, not as a network error.
  useEffect(() => {
    let active = true;

    getProductById(id)
      .then(({ data }) => { if (active) { setProduct(data); setLoadStatus('ready'); } })
      .catch((err) => {
        if (!active) return;
        const status = err.response?.status;
        const message = err.response?.data?.message || '';
        if (status === 404 || /cast to objectid failed/i.test(message)) {
          setLoadStatus('notfound');
        } else {
          setLoadStatus('error');
        }
      });

    return () => { active = false; };
  }, [id, retryKey]);

  // Scroll to top whenever we navigate to a different product.
  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  useEffect(() => {
    if (!product) return;
    document.title = `${product.name} | ${SHOP_INFO.name}`;
    return () => { document.title = DEFAULT_TITLE; };
  }, [product]);

  // "You may also like" — same category, excluding this product.
  useEffect(() => {
    if (!product) return;
    let active = true;
    getProducts({ category: product.category, limit: 9 })
      .then(({ data }) => {
        if (!active) return;
        setRelated((data.products || []).filter((p) => p._id !== product._id).slice(0, 8));
      })
      .catch(() => { if (active) setRelated([]); });
    return () => { active = false; };
  }, [product]);

  if (loadStatus === 'loading') {
    return (
      <div className="animate-fade" style={{ display: 'flex', gap: '40px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={{ flex: '1 1 0%', minWidth: 0, width: isMobile ? '100%' : undefined }}>
          <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '20px', background: 'var(--bg-card)', backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
        </div>
        <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px', width: isMobile ? '100%' : undefined }}>
          {[24, 40, 36, 48, 50, 160].map((h, i) => <SkeletonBlock key={i} height={h} />)}
        </div>
      </div>
    );
  }

  if (loadStatus === 'notfound') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Package size={36} style={{ opacity: 0.35 }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>{t('notFound.title')}</p>
        <p style={{ fontSize: '14px', marginBottom: '20px' }}>{t('notFound.subtitle')}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>{t('actions.backToShop')}</button>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertTriangle size={36} style={{ opacity: 0.35, color: 'var(--accent-red)' }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>{t('error.title')}</p>
        <p style={{ fontSize: '14px', marginBottom: '20px' }}>{t('error.subtitle')}</p>
        <button className="btn-primary" onClick={() => { setLoadStatus('loading'); setRetryKey((k) => k + 1); }}>{t('actions.tryAgain')}</button>
      </div>
    );
  }

  const images = product.images?.length ? product.images : (product.image ? [product.image] : []);
  const knownStock = typeof liveStock[product._id] === 'number' ? liveStock[product._id] : product.stock_quantity;
  const outOfStock = knownStock <= 0;
  const lowStock = !outOfStock && knownStock < 5;
  const effectiveQty = Math.min(qty, Math.max(knownStock, 1));

  const specs = [
    { label: t('specs.brand'), value: product.brand },
    { label: t('specs.partNumber'), value: product.sku_code },
    { label: t('specs.category'), value: product.category },
    { label: t('specs.subCategory'), value: product.sub_category },
    { label: t('specs.barcode'), value: product.barcode },
    { label: t('specs.unit'), value: product.unit },
  ].filter((s) => s.value);

  const descriptionNeedsClamp = !!product.description && (product.description.split('\n').length > 6 || product.description.length > 400);

  const whatsappHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t('whatsappMessage', { name: product.name, sku: product.sku_code, qty: effectiveQty, price: formatLKR(product.selling_price * effectiveQty) }))}`
    : null;

  // CartContext's addToCart has no quantity parameter (its API isn't being
  // changed for this task) — called once per unit, same as CartPage's own
  // Undo button does. Each call fires its own "Added to cart" toast, so all
  // but the last are dismissed, leaving exactly one visible — the existing
  // toast, unchanged, just shown once instead of N times.
  const handleAddToCart = () => {
    for (let i = 0; i < effectiveQty; i += 1) {
      addToCart(product);
      if (i < effectiveQty - 1) toast.dismiss();
    }
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/checkout');
  };

  return (
    <>
      <div className="animate-fade" style={{ paddingBottom: isMobile ? '110px' : '40px' }}>
        {/* Breadcrumbs */}
        <nav aria-label={t('aria.breadcrumb')} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{t('breadcrumb.home')}</Link>
          <ChevronRight size={12} />
          <Link to={`/category/${slugify(product.category)}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{product.category}</Link>
          <ChevronRight size={12} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{product.name}</span>
        </nav>

        <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {/* Image column */}
          <div style={{ flex: '1 1 0%', minWidth: 0, width: isMobile ? '100%' : undefined, position: isMobile ? 'static' : 'sticky', top: '24px' }}>
            <ProductImage product={{ ...product, images: images.length ? [images[activeImage]] : [] }} priority style={{ borderRadius: '20px', border: '1px solid var(--border-light)' }}>
              {outOfStock ? (
                <span className="badge badge-red" style={{ position: 'absolute', top: '14px', left: '14px' }}>{t('stock.outOfStock')}</span>
              ) : lowStock ? (
                <span className="badge badge-yellow" style={{ position: 'absolute', top: '14px', left: '14px' }}>{t('stock.lowStock', { count: knownStock })}</span>
              ) : null}
            </ProductImage>
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {images.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={t('gallery.showImage', { index: i + 1 })}
                    aria-current={i === activeImage}
                    style={{
                      width: '60px', height: '60px', borderRadius: '10px', overflow: 'hidden', padding: 0,
                      cursor: 'pointer', flexShrink: 0,
                      border: i === activeImage ? '2px solid var(--accent-primary)' : '1px solid var(--border-light)',
                    }}
                  >
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info column */}
          <div style={{ flex: '1 1 0%', minWidth: 0, width: isMobile ? '100%' : undefined }}>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: '10px' }}>
              {product.name}
            </h1>

            {(product.brand || product.sku_code) && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {product.brand && <span className="badge badge-blue">{product.brand}</span>}
                {product.sku_code && <span className="badge badge-purple" style={{ fontFamily: 'monospace' }}>{t('skuPrefix', { sku: product.sku_code })}</span>}
              </div>
            )}

            <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--accent-primary)', marginBottom: '10px' }}>
              {formatLKR(product.selling_price)}
            </div>

            <p
              aria-live="polite"
              style={{
                fontSize: '13px', fontWeight: 700, marginBottom: '20px',
                color: outOfStock ? 'var(--accent-red)' : lowStock ? 'var(--accent-yellow)' : 'var(--accent-green)',
              }}
            >
              {outOfStock ? t('stock.outOfStock') : lowStock ? t('stock.lowStock', { count: knownStock }) : t('stock.inStock')}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <QuantityStepper
                qty={effectiveQty}
                min={1}
                max={outOfStock ? 0 : knownStock}
                onIncrement={() => setQty((q) => Math.min(q + 1, knownStock))}
                onDecrement={() => setQty((q) => Math.max(1, q - 1))}
                size="md"
              />
              <button
                className="btn-primary"
                onClick={handleAddToCart}
                disabled={outOfStock}
                style={{ flex: '1 1 180px', justifyContent: 'center', padding: '14px', borderRadius: '999px', opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer' }}
              >
                <ShoppingCart size={18} /> {t('actions.addToCart')}
              </button>
            </div>

            <button
              className="btn-secondary"
              onClick={handleBuyNow}
              disabled={outOfStock}
              style={{ width: '100%', justifyContent: 'center', padding: '13px', borderRadius: '999px', marginBottom: '12px', opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer' }}
            >
              {t('actions.buyNow')}
            </button>

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', borderRadius: '999px', marginBottom: '20px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <MessageCircle size={16} /> {t('actions.whatsapp')}
              </a>
            )}

            {/* Trust row — same style/strings as OrderSummary's */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
              {[
                { Icon: ShieldCheck, label: tCart('trust.cod') },
                { Icon: Truck, label: tCart('trust.delivery') },
                { Icon: RotateCcw, label: tCart('trust.returns') },
                // eslint-disable-next-line no-unused-vars
              ].map(({ Icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <Icon size={15} color="var(--accent-primary)" /> {label}
                </div>
              ))}
            </div>

            {specs.length > 0 && (
              <div className="glass-card" style={{ padding: '24px', borderRadius: '20px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>{t('sections.specifications')}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 20px' }}>
                  {specs.map((s) => (
                    <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No vehicle-compatibility/fitment field exists on the Product
                model (see Step 0 finding #1) — this card is intentionally
                never rendered. Reported, not backfilled, per the no-backend-
                changes constraint. */}

            {product.description && (
              <div className="glass-card" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>{t('sections.description')}</h2>
                <p style={{
                  fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0,
                  display: descExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: descExpanded ? 'unset' : 6,
                  WebkitBoxOrient: 'vertical',
                  overflow: descExpanded ? 'visible' : 'hidden',
                }}>
                  {product.description}
                </p>
                {descriptionNeedsClamp && (
                  <button
                    onClick={() => setDescExpanded((e) => !e)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginTop: '10px', padding: 0 }}
                  >
                    {descExpanded ? t('sections.showLess') : t('sections.showMore')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div style={{ marginTop: '56px' }}>
            <h2 className="page-title" style={{ fontSize: '20px', marginBottom: '20px' }}>{t('sections.relatedTitle')}</h2>
            <div style={{
              display: isMobile ? 'flex' : 'grid',
              gridTemplateColumns: isMobile ? undefined : 'repeat(4, 1fr)',
              overflowX: isMobile ? 'auto' : undefined,
              scrollSnapType: isMobile ? 'x mandatory' : undefined,
              gap: '16px',
            }}>
              {related.map((p, idx) => (
                <div key={p._id} style={isMobile ? { flex: '0 0 220px', scrollSnapAlign: 'start' } : undefined}>
                  <ProductCard product={p} index={idx} onCardClick={() => navigate(`/product/${p._id}`)} onAddToCart={addToCart} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky bottom bar — a sibling of .animate-fade, not inside
          it: the earlier cart-drawer work found that a CSS animation on an
          ancestor leaves a containing block behind that breaks
          position:fixed descendants (see index.css's .animate-fade comment
          and CartPage.jsx's identical sticky bar). */}
      {isMobile && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
          background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(14px)',
          borderTop: '1px solid var(--border-light)',
          padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{tCart('summary.total')}</div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatLKR(product.selling_price * effectiveQty)}</div>
          </div>
          <button
            className="btn-primary"
            onClick={handleAddToCart}
            disabled={outOfStock}
            style={{ padding: '12px 22px', borderRadius: '14px', opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer' }}
          >
            <ShoppingCart size={16} /> {t('actions.addToCart')}
          </button>
        </div>
      )}
    </>
  );
}
