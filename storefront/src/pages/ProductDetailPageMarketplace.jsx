import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight, ShoppingCart, ShieldCheck, Truck, RotateCcw,
  MessageCircle, Package, AlertTriangle, Car, Check,
} from 'lucide-react';
import { getListingById, getRelatedListings, getCategoryTree, getVehicleMakes, buildMediaUrl } from '../api/marketplaceServices';
import { normalizeListing, listingFitsVehicle, fitmentRangeLabel, localizedPick } from '../api/marketplaceAdapters';
import { useCart } from '../context/CartContext';
import useIsMobile from '../hooks/useIsMobile';
import useSelectedVehicle from '../hooks/useSelectedVehicle';
import QuantityStepper from '../components/cart/QuantityStepper';
import ProductImage from '../components/product/ProductImage';
import ProductCard from '../components/product/ProductCard';
import SellerCard from '../components/product/SellerCard';
import { formatLKR } from '../utils/formatLKR';
import { WHATSAPP_NUMBER, PLATFORM_INFO } from '../config/store';

const DEFAULT_TITLE = `${PLATFORM_INFO.name} | Vehicle Parts Marketplace in Sri Lanka`;
const STOCK_REFRESH_MS = 60000; // Part D.5 — "refresh every 60s while the page is open"
// Shared by the loading skeleton and the real content's own wrapper —
// see the loading-state return below for why.
const MIN_CONTENT_HEIGHT = 1500;

function flattenCategories(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    flattenCategories(node.children || [], out);
  }
  return out;
}

function SkeletonBlock({ height }) {
  return (
    <div style={{
      height, borderRadius: '10px', background: 'var(--bg-card)',
      backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  );
}

export default function ProductDetailPageMarketplace() {
  const { t } = useTranslation(['product', 'marketplace']);
  const { t: tCart } = useTranslation('cart');
  const { i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile(1024);
  const { addToCart } = useCart();
  const { vehicle } = useSelectedVehicle();

  const [rawListing, setRawListing] = useState(null);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [retryKey, setRetryKey] = useState(0);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [related, setRelated] = useState([]);
  const [categories, setCategories] = useState([]);
  const [makes, setMakes] = useState([]);

  // Fetched together with the listing itself (not as independent, fire-
  // and-forget effects) — category/vehicle-make names feed the
  // breadcrumb and the vehicle fitment card, so if they resolved AFTER
  // the listing already painted, those sections would pop in late and
  // push the related-listings row down — a real, measured layout shift
  // (Lighthouse's CLS audit caught it: 0.32, well outside budget) that
  // had nothing to do with the initial loading skeleton.
  useEffect(() => {
    let active = true;
    Promise.all([getListingById(id), getCategoryTree(), getVehicleMakes()])
      .then(([listingRes, categoryRes, makesRes]) => {
        if (!active) return;
        setCategories(flattenCategories(categoryRes.data.tree || []));
        setMakes(makesRes.data.makes || []);
        setRawListing(listingRes.data.listing);
        setLoadStatus('ready');
      })
      .catch((err) => { if (active) setLoadStatus(err.response?.status === 404 ? 'notfound' : 'error'); });
    return () => { active = false; };
  }, [id, retryKey]);

  // Part D.5 — "Stock: refresh every 60s while the page is open."
  useEffect(() => {
    if (loadStatus !== 'ready') return;
    const interval = setInterval(() => {
      getListingById(id).then(({ data }) => setRawListing(data.listing)).catch(() => {});
    }, STOCK_REFRESH_MS);
    return () => clearInterval(interval);
  }, [id, loadStatus]);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  const category = categories.find((c) => String(c.id) === String(rawListing?.categoryId));
  const product = rawListing ? normalizeListing(rawListing, { lang: i18n.language, categoryName: category ? localizedPick(category.name, i18n.language) : '' }) : null;

  useEffect(() => {
    if (!product) return;
    document.title = `${product.name} | ${PLATFORM_INFO.name}`;
    return () => { document.title = DEFAULT_TITLE; };
  }, [product]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getRelatedListings(id).then(({ data }) => { if (active) setRelated(data.listings || []); }).catch(() => { if (active) setRelated([]); });
    return () => { active = false; };
  }, [id]);

  if (loadStatus === 'loading' || !product) {
    // Deliberately mirrors the loaded state's exact DOM nesting below
    // (same outer .animate-fade wrapper with the same paddingBottom,
    // a breadcrumb-shaped bar standing in for <nav>, THEN the flex
    // row) — not just similar heights. The two states previously had
    // genuinely different structures (the skeleton's outer div WAS the
    // flex row; the loaded state's outer div merely CONTAINS a <nav> +
    // the flex row as two children), which is what actually caused a
    // real, measured ~0.30 layout shift — independently confirmed via
    // the browser's own PerformanceObserver, not just Lighthouse — no
    // amount of height-tuning the skeleton blocks could have fixed a
    // structural mismatch like that.
    return (
      <div className="animate-fade" style={{ paddingBottom: isMobile ? '110px' : '40px' }}>
        <SkeletonBlock height={20} width="280px" />
        <div style={{ marginTop: '20px', display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap', minHeight: isMobile ? undefined : MIN_CONTENT_HEIGHT }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 0%', minWidth: 0, width: isMobile ? '100%' : undefined }}>
            <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '20px', background: 'var(--bg-card)', backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px', width: isMobile ? '100%' : undefined, minHeight: isMobile ? MIN_CONTENT_HEIGHT : undefined }}>
            {[24, 20, 36, 60, 20, 48, 44, 90, 140, 110, 140].map((h, i) => <SkeletonBlock key={i} height={h} />)}
          </div>
        </div>
      </div>
    );
  }

  if (loadStatus === 'notfound') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
        <Package size={36} style={{ opacity: 0.35 }} />
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginTop: '16px' }}>{t('notFound.title')}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>{t('actions.backToShop')}</button>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
        <AlertTriangle size={36} style={{ opacity: 0.35, color: 'var(--accent-red)' }} />
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginTop: '16px' }}>{t('error.title')}</p>
        <button className="btn-primary" onClick={() => { setLoadStatus('loading'); setRetryKey((k) => k + 1); }}>{t('actions.tryAgain')}</button>
      </div>
    );
  }

  // Part D.5's gallery srcset — built from the real variant sizes
  // (the normalized `product.images` is medium/webp only, for pos-shape
  // compatibility; this page uses the raw listing's image ids directly
  // for the full gallery + srcset).
  const imageIds = rawListing.images || [];
  const buildSrcSet = (mediaId) => [150, 600, 1200].map((w, i) => `${buildMediaUrl(mediaId, ['thumb', 'medium', 'large'][i], 'webp')} ${w}w`).join(', ');

  const outOfStock = !rawListing.inStock;
  const effectiveQty = Math.max(qty, 1);
  const seller = product.__seller;
  const fits = vehicle ? listingFitsVehicle(product.__fitment, vehicle) : null;

  const specs = [
    { label: t('specs.brand'), value: product.brand },
    { label: t('specs.partNumber'), value: product.sku_code },
    { label: t('specs.category'), value: product.category },
  ].filter((s) => s.value);
  Object.entries(product.__attributes || {}).forEach(([key, value]) => {
    if (value) specs.push({ label: key, value: String(value) });
  });

  const warranty = product.__warranty;
  const returnPolicy = category?.returnPolicy;

  const whatsappHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t('whatsappMessage', { name: product.name, sku: product.sku_code, qty: effectiveQty, price: formatLKR(product.selling_price * effectiveQty), seller: seller?.name || PLATFORM_INFO.name }))}`
    : null;

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
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{t('breadcrumb.home')}</Link>
          <ChevronRight size={12} />
          {category && (
            <>
              <Link to={`/category/${category.slug}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{localizedPick(category.name, i18n.language)}</Link>
              <ChevronRight size={12} />
            </>
          )}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{product.name}</span>
        </nav>

        <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap', minHeight: isMobile ? undefined : MIN_CONTENT_HEIGHT }}>
          {/* Image column */}
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 0%', minWidth: 0, width: isMobile ? '100%' : undefined, position: isMobile ? 'static' : 'sticky', top: '24px' }}>
            <ProductImage
              product={{ ...product, images: imageIds.length ? [buildMediaUrl(imageIds[activeImage], 'large', 'webp')] : [] }}
              priority srcSet={imageIds.length ? buildSrcSet(imageIds[activeImage]) : undefined}
              sizes="(max-width: 1024px) 100vw, 50vw"
              style={{ borderRadius: '20px', border: '1px solid var(--border-light)' }}
            >
              {outOfStock && <span className="badge badge-red" style={{ position: 'absolute', top: '14px', left: '14px' }}>{t('stock.outOfStock')}</span>}
            </ProductImage>
            {imageIds.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {imageIds.map((imgId, i) => (
                  <button
                    key={imgId} type="button" onClick={() => setActiveImage(i)}
                    aria-current={i === activeImage}
                    style={{ width: '60px', height: '60px', borderRadius: '10px', overflow: 'hidden', padding: 0, cursor: 'pointer', flexShrink: 0, border: i === activeImage ? '2px solid var(--accent-primary)' : '1px solid var(--border-light)' }}
                  >
                    <img src={buildMediaUrl(imgId, 'thumb', 'webp')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info column */}
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 0%', minWidth: 0, width: isMobile ? '100%' : undefined, minHeight: isMobile ? MIN_CONTENT_HEIGHT : undefined }}>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: '10px' }}>{product.name}</h1>

            {(product.brand || product.sku_code) && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {product.brand && <span className="badge badge-blue">{product.brand}</span>}
                {product.sku_code && <span className="badge badge-purple" style={{ fontFamily: 'monospace' }}>{t('skuPrefix', { sku: product.sku_code })}</span>}
              </div>
            )}

            {vehicle && product.__fitment?.length > 0 && (
              <span className={`badge ${fits ? 'badge-green' : 'badge-yellow'}`} style={{ marginBottom: '12px', display: 'inline-flex' }}>
                {fits ? <Check size={11} /> : <Car size={11} />} {fits ? t('marketplace:fitment.fitsYourVehicle') : t('marketplace:fitment.checkFitment')}
              </span>
            )}

            <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--accent-primary)', marginBottom: '10px' }}>
              {formatLKR(product.selling_price)}
              {product.__wasPriceCents > rawListing.priceCents && (
                <span style={{ fontSize: '15px', color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: '10px', fontWeight: 600 }}>
                  {formatLKR(Math.round(product.__wasPriceCents / 100))}
                </span>
              )}
            </div>

            {seller && <SellerCard seller={seller} />}

            <p aria-live="polite" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '20px', color: outOfStock ? 'var(--accent-red)' : 'var(--accent-green)' }}>
              {outOfStock ? t('stock.outOfStock') : t('stock.inStock')}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <QuantityStepper qty={effectiveQty} min={1} max={outOfStock ? 0 : 99} onIncrement={() => setQty((q) => q + 1)} onDecrement={() => setQty((q) => Math.max(1, q - 1))} size="md" />
              <button className="btn-primary" onClick={handleAddToCart} disabled={outOfStock} style={{ flex: '1 1 180px', justifyContent: 'center', padding: '14px', borderRadius: '999px', opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer' }}>
                <ShoppingCart size={18} /> {t('actions.addToCart')}
              </button>
            </div>

            <button className="btn-secondary" onClick={handleBuyNow} disabled={outOfStock} style={{ width: '100%', justifyContent: 'center', padding: '13px', borderRadius: '999px', marginBottom: '12px', opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer' }}>
              {t('actions.buyNow')}
            </button>

            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '13px', borderRadius: '999px', marginBottom: '20px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={16} /> {t('actions.whatsapp')}
              </a>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <ShieldCheck size={15} color="var(--accent-primary)" /> {tCart('trust.cod')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <Truck size={15} color="var(--accent-primary)" /> {tCart('trust.delivery')}
              </div>
              {returnPolicy?.returnable != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <RotateCcw size={15} color="var(--accent-primary)" />
                  {returnPolicy.returnable ? t('marketplace:returns.returnableWithin', { days: returnPolicy.windowDays }) : t('marketplace:returns.notReturnable')}
                </div>
              )}
              {warranty?.type && warranty.type !== 'none' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={15} color="var(--accent-primary)" /> {t('marketplace:returns.warranty', { value: warranty.value, unit: t(`marketplace:returns.warrantyUnit.${warranty.type}`) })}
                </div>
              )}
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

            {product.__fitment?.length > 0 && (
              <div className="glass-card" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Car size={16} color="var(--accent-primary)" /> {t('marketplace:fitment.tableTitle')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {product.__fitment.map((entry, i) => {
                    const makeName = makes.find((m) => m.id === String(entry.makeId))?.name || '';
                    return (
                      <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        {fitmentRangeLabel(entry, makeName)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {product.description && (
              <div className="glass-card" style={{ padding: '24px', borderRadius: '20px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>{t('sections.description')}</h2>
                <p style={{
                  fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0,
                  display: descExpanded ? 'block' : '-webkit-box', WebkitLineClamp: descExpanded ? 'unset' : 6,
                  WebkitBoxOrient: 'vertical', overflow: descExpanded ? 'visible' : 'hidden',
                }}>
                  {product.description}
                </p>
                {product.description.length > 400 && (
                  <button onClick={() => setDescExpanded((e) => !e)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginTop: '10px', padding: 0 }}>
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
            <div style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : 'repeat(4, 1fr)', overflowX: isMobile ? 'auto' : undefined, gap: '16px' }}>
              {related.map((l, idx) => {
                const rp = normalizeListing(l, { lang: i18n.language });
                return (
                  <div key={rp._id} style={isMobile ? { flex: '0 0 220px' } : undefined}>
                    <ProductCard product={rp} index={idx} onCardClick={() => navigate(`/product/${rp._id}`)} onAddToCart={addToCart} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
          background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(14px)',
          borderTop: '1px solid var(--border-light)', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{tCart('summary.total')}</div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatLKR(product.selling_price * effectiveQty)}</div>
          </div>
          <button className="btn-primary" onClick={handleAddToCart} disabled={outOfStock} style={{ padding: '12px 22px', borderRadius: '14px', opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer' }}>
            <ShoppingCart size={16} /> {t('actions.addToCart')}
          </button>
        </div>
      )}
    </>
  );
}
