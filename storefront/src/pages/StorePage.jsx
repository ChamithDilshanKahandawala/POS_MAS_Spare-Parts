import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, MessageCircle, MapPin, Clock, BadgeCheck, Package, ChevronRight } from 'lucide-react';
import { getProducts } from '../api/services';
import { useCart } from '../context/CartContext';
import { getSellerBySlug, formatPhoneDisplay, CATEGORIES } from '../config/store';
import { isShopOpenNow } from '../utils/openStatus';
import ProductGrid from '../components/product/ProductGrid';
import Logo from '../components/layout/Logo';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import { buildShopJsonLd } from '../utils/shopJsonLd';

// A seller's own storefront within the Apexora marketplace. Every product
// belongs to the single seller today (getSellerForProduct()), so filtering
// "this seller's products" is really just "all products" for now — but the
// page itself (header, hours, products grid) is written the same way it
// would be with a real multi-seller catalog, so nothing here needs to
// change once a product-to-seller field actually exists.
export default function StorePage() {
  const { t } = useTranslation('platform');
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const seller = getSellerBySlug(slug);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [isOpen, setIsOpen] = useState(() => (seller ? isShopOpenNow(seller.hours) : false));

  useDocumentMeta(
    seller ? t('store.metaTitle', { seller: seller.name }) : t('store.notFoundTitle'),
    seller ? t('store.metaDescription', { seller: seller.name }) : undefined
  );
  useJsonLd(seller ? buildShopJsonLd() : null);

  useEffect(() => {
    if (!seller) return;
    const id = setInterval(() => setIsOpen(isShopOpenNow(seller.hours)), 30000);
    return () => clearInterval(id);
  }, [seller]);

  // The route renders this page with key={slug} (see App.jsx), so loading's
  // own initial value is already fresh on every seller change — just
  // "fetch, then setState from the result" (same pattern as CategoryPage).
  useEffect(() => {
    if (!seller) return;
    let active = true;
    getProducts({ limit: 500 })
      .then(({ data }) => { if (active) { setProducts(data.products || []); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [seller]);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  const filtered = useMemo(() => {
    if (category === 'All') return products;
    return products.filter((p) => p.category === category);
  }, [products, category]);

  const presentCategories = useMemo(
    () => CATEGORIES.filter((c) => products.some((p) => p.category === c)),
    [products]
  );

  if (!seller) {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Package size={36} style={{ opacity: 0.35, color: 'var(--text-muted)' }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>{t('store.notFoundTitle')}</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('store.notFoundSubtitle')}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>{t('store.backToShop')}</button>
      </div>
    );
  }

  const whatsappHref = `https://wa.me/${seller.whatsapp}`;

  return (
    <div className="animate-fade" style={{ paddingBottom: '40px' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{t('product:breadcrumb.home')}</Link>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{seller.name}</span>
      </nav>

      {/* Seller header */}
      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <Logo size={56} style={{ borderRadius: '14px', background: 'white', padding: '3px', border: '2px solid var(--accent-light)', boxSizing: 'border-box' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{seller.name}</h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700,
                color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '3px 9px', borderRadius: '999px',
              }}>
                <BadgeCheck size={12} /> {t('verifiedSeller')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              <MapPin size={13} /> {t('store.location')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          {seller.phones.map((phone) => (
            <a key={phone} href={`tel:${phone}`} className="btn-secondary" style={{ textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>
              <Phone size={14} /> {formatPhoneDisplay(phone)}
            </a>
          ))}
          <a
            href={whatsappHref} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#128037', color: 'white',
              textDecoration: 'none', padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
            }}
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <Clock size={14} color="var(--accent-primary)" />
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
            color: isOpen ? '#10b981' : '#e74c3c',
            background: isOpen ? 'rgba(16,185,129,0.12)' : 'rgba(231,76,60,0.12)',
          }}>
            {isOpen ? t('contact:openNow') : t('contact:closedNow')}
          </span>
        </div>
      </div>

      {/* About this store */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>{t('store.aboutHeading')}</h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {t('about:story.paragraphs.0')}
        </p>
      </div>

      {/* Products */}
      <h2 className="page-title" style={{ marginBottom: '16px' }}>{t('store.productsHeading', { seller: seller.name })}</h2>

      {presentCategories.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px' }}>
          {['All', ...presentCategories].map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={active}
                style={{
                  flexShrink: 0, padding: '8px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', border: '1px solid var(--border-light)', whiteSpace: 'nowrap',
                  background: active ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-secondary)',
                  color: active ? 'white' : 'var(--text-muted)',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      <ProductGrid
        products={filtered}
        loading={loading}
        onCardClick={(p) => navigate(`/product/${p._id}`)}
        onAddToCart={addToCart}
      />
    </div>
  );
}
