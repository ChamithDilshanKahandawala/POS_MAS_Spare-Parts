import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import { getProducts } from '../api/services';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, X, ArrowRight, ShieldCheck, Package, Truck, CheckCircle, Zap } from 'lucide-react';
import { useCart } from '../context/CartContext';
import ProductGrid from '../components/product/ProductGrid';
import { formatLKR } from '../utils/formatLKR';
import { slugify } from '../utils/slugify';
import { CATEGORIES as REAL_CATEGORIES } from '../config/store';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import { buildShopJsonLd } from '../utils/shopJsonLd';

// "All" stays as a local filter (there's no dedicated page for it); every
// real category now navigates to its own /category/:slug page instead of
// filtering in place — see CategoryPage.jsx.
const CATEGORIES = ['All', ...REAL_CATEGORIES];

export default function StorefrontPage() {
  const { t } = useTranslation(['product', 'common']);
  useDocumentMeta(t('common:home.metaTitle'), t('common:home.metaDescription'));
  useJsonLd(buildShopJsonLd());
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [liveUpdatedIds, setLiveUpdatedIds] = useState(new Set());

  const { addToCart } = useCart();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProducts({ search, category, limit: 100 });
      setProducts(data.products || []);
    } catch {
      toast.error(t('catalog.failedToLoad'));
    } finally {
      setLoading(false);
    }
    // `t` deliberately excluded: it's always live-bound to the i18next
    // instance regardless of which render's closure holds it, so an older
    // reference still returns the current language's text. Depending on it
    // would refetch (and flash the loading skeleton) on every language
    // switch for no benefit — including resetting scroll position, which
    // broke "switching language keeps scroll position" when first tried.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Socket.io real-time stock sync
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', { transports: ['websocket', 'polling'] });
    socket.on('stock_updated', (updates) => {
      setProducts(prev =>
        prev.map(p => {
          const update = updates.find(u => u.productId === p._id);
          return update ? { ...p, stock_quantity: update.newQuantity } : p;
        })
      );
      const updatedIds = new Set(updates.map(u => u.productId));
      setLiveUpdatedIds(updatedIds);
      setTimeout(() => setLiveUpdatedIds(new Set()), 2500);
      setSelectedProduct(prev => {
        if (!prev) return prev;
        const update = updates.find(u => u.productId === prev._id);
        return update ? { ...prev, stock_quantity: update.newQuantity } : prev;
      });
    });
    return () => socket.disconnect();
  }, []);

  return (
    <>
      <div className="animate-fade">
        {/* ── Hero Section ── */}
        <div style={{
          background: 'var(--hero-gradient)',
          borderRadius: '20px', padding: '48px 40px', color: 'white',
          marginBottom: '40px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '32px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative shapes */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: '-60px', left: '30%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

          <div style={{ maxWidth: '560px', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
              <Zap size={13} /> {t('hero.badge')}
            </div>
            <h2 style={{ fontSize: '34px', fontWeight: 900, marginBottom: '14px', lineHeight: 1.15 }}>
              {t('hero.titleLine1')}<br/>{t('hero.titleLine2')}
            </h2>
            <p style={{ fontSize: '15px', opacity: 0.92, marginBottom: '24px', lineHeight: 1.7, maxWidth: '460px' }}>
              {t('hero.subtitle')}
            </p>
            <button 
              onClick={() => document.getElementById('catalog').scrollIntoView({behavior: 'smooth'})}
              style={{
                background: 'white', color: 'var(--accent-primary)', border: 'none',
                padding: '13px 28px', fontSize: '15px', fontWeight: 700,
                borderRadius: '12px', cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '8px', transition: 'all 0.25s',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              {t('hero.browseCatalog')} <ArrowRight size={16} />
            </button>
          </div>

          {/* Hero right — trust indicators */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            {[
              { icon: ShieldCheck, label: t('hero.genuine'), sub: t('hero.oemParts') },
              { icon: Truck, label: t('hero.islandwide'), sub: t('hero.delivery') },
              { icon: CheckCircle, label: t('hero.warranty'), sub: t('hero.guaranteed') },
            ].map(t => (
              <div key={t.label} style={{
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                borderRadius: '16px', padding: '20px 18px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.2)', minWidth: '110px',
              }}>
                <t.icon size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: '14px', fontWeight: 800 }}>{t.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{t.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Search and Filter Bar ── */}
        <div id="catalog" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '24px', flexWrap: 'wrap', gap: '16px',
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('catalog.heading')}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              {t('catalog.count', { count: products.length })}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '600px', minWidth: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" placeholder={t('catalog.searchPlaceholder')} 
                className="input-field"
                style={{ paddingLeft: '36px', width: '100%', borderRadius: '12px' }}
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            {/* Category pills — scrolls horizontally instead of wrapping/
                overflowing now that the full 11-category list (not the old
                9-item subset) renders here too. */}
            <div style={{
              display: 'flex', gap: '4px', padding: '3px',
              background: 'var(--bg-secondary)', borderRadius: '12px',
              border: '1px solid var(--border-light)',
              overflowX: 'auto', maxWidth: '100%', minWidth: 0,
            }}>
              {CATEGORIES.map(c => {
                const pillStyle = {
                  padding: '7px 14px', borderRadius: '9px', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer', border: 'none',
                  whiteSpace: 'nowrap', transition: 'all 0.2s', textDecoration: 'none',
                  display: 'inline-block',
                  background: category === c
                    ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                    : 'transparent',
                  color: category === c ? 'white' : 'var(--text-muted)',
                };
                return c === 'All' ? (
                  <button key={c} onClick={() => setCategory(c)} style={pillStyle}>{c}</button>
                ) : (
                  <Link key={c} to={`/category/${slugify(c)}`} style={pillStyle}>{c}</Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Product Grid ── */}
        <ProductGrid
          products={products}
          loading={loading}
          liveUpdatedIds={liveUpdatedIds}
          onCardClick={(p) => setSelectedProduct(p)}
          onAddToCart={addToCart}
        />
      </div>

      {/* ── Product Quick View Modal ── */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{
            maxWidth: '800px', display: 'flex', gap: '32px', flexWrap: 'wrap', padding: '0', overflow: 'hidden',
          }}>
            {/* Left — Image area */}
            <div style={{
              flex: '1 1 300px', background: 'var(--bg-secondary)', minHeight: '320px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              <Package size={64} color="var(--text-muted)" style={{ opacity: 0.1 }} />
              <span style={{
                position: 'absolute', top: '16px', left: '16px',
              }} className={`badge ${selectedProduct.stock_quantity > 10 ? 'badge-green' : selectedProduct.stock_quantity > 0 ? 'badge-yellow' : 'badge-red'}`}>
                {selectedProduct.stock_quantity > 0 ? t('card.inStockCount', { count: selectedProduct.stock_quantity }) : t('stock.outOfStock')}
              </span>
            </div>
            
            {/* Right — Info */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', padding: '28px 28px 28px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {selectedProduct.category}
                </span>
                <button onClick={() => setSelectedProduct(null)} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                  borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}><X size={16} /></button>
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: 1.2 }}>{selectedProduct.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>
                SKU: <span style={{ fontFamily: 'monospace' }}>{selectedProduct.sku_code}</span>
              </p>

              <div style={{
                padding: '14px 16px', background: 'var(--bg-secondary)',
                borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-light)',
              }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{t('quickViewModal.descriptionTitle')}</strong><br/>
                  <span style={{ opacity: 0.85 }}>
                    {t('quickViewModal.descriptionBody', { category: selectedProduct.category.toLowerCase() })}
                  </span>
                </p>
              </div>

              {/* Trust indicators */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {[
                  { icon: ShieldCheck, label: t('quickViewModal.genuine') },
                  { icon: Truck, label: t('quickViewModal.fastDelivery') },
                  { icon: CheckCircle, label: t('quickViewModal.warranty') },
                ].map(t => (
                  <div key={t.label} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)', padding: '5px 10px',
                    borderRadius: '8px', border: '1px solid var(--border-light)',
                  }}>
                    <t.icon size={12} color="var(--accent-primary)" /> {t.label}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--accent-primary)', marginBottom: '16px' }}>
                  {formatLKR(selectedProduct.selling_price)}
                </div>
                <button 
                  onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  disabled={selectedProduct.stock_quantity <= 0}
                  className="btn-primary"
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px',
                    fontSize: '15px', justifyContent: 'center',
                  }}
                >
                  <ShoppingCart size={18} /> {t('quickViewModal.addToCart')}
                </button>
                <Link
                  to={`/product/${selectedProduct._id}`}
                  onClick={() => setSelectedProduct(null)}
                  style={{
                    display: 'block', textAlign: 'center', marginTop: '12px',
                    fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none',
                  }}
                >
                  {t('actions.viewFullDetails')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
