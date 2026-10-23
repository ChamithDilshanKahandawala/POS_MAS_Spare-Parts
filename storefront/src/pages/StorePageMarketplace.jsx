import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, MessageCircle, MapPin, Clock, BadgeCheck, Package, ChevronRight, Store } from 'lucide-react';
import { getStorePage, getListings, getCategoryTree, buildStoreLogoUrl, buildStoreBannerUrl } from '../api/marketplaceServices';
import { normalizeListing, localizedPick } from '../api/marketplaceAdapters';
import { useCart } from '../context/CartContext';
import ProductGrid from '../components/product/ProductGrid';
import useDocumentMeta from '../hooks/useDocumentMeta';

const WEEKDAY_INDEX = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function isOpenNow(operatingHours) {
  if (!operatingHours?.length) return false;
  const today = operatingHours.find((d) => d.day === WEEKDAY_INDEX[new Date().getDay()]);
  if (!today || today.closed || !today.open || !today.close) return false;
  const now = new Date();
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= oh * 60 + om && mins <= ch * 60 + cm;
}

function flattenCategories(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    flattenCategories(node.children || [], out);
  }
  return out;
}

// Milestone 5 Part D.6 — a real marketplace seller's storefront, from
// GET /api/public/stores/:slug + the listings endpoint's sellerSlug filter.
export default function StorePageMarketplace() {
  const { t, i18n } = useTranslation(['product', 'platform', 'contact']);
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [store, setStore] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');

  useDocumentMeta(store ? t('platform:store.metaTitle', { seller: store.name }) : t('platform:store.notFoundTitle'));

  useEffect(() => {
    getCategoryTree().then(({ data }) => setCategories(flattenCategories(data.tree || []))).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getStorePage(slug)
      .then(({ data }) => { if (active) setStore(data.store); })
      .catch(() => { if (active) setNotFound(true); });
    getListings({ sellerSlug: slug, limit: 60 })
      .then(({ data }) => { if (active) setListings(data.listings || []); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [String(c.id), localizedPick(c.name, i18n.language)])), [categories, i18n.language]);
  const products = useMemo(() => listings.map((l) => normalizeListing(l, { lang: i18n.language, categoryName: categoryNameById.get(String(l.categoryId)) || '' })), [listings, i18n.language, categoryNameById]);
  const presentCategories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products]);
  const filtered = categoryFilter ? products.filter((p) => p.category === categoryFilter) : products;

  if (notFound) {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <Package size={36} style={{ opacity: 0.35, color: 'var(--text-muted)' }} />
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginTop: '16px' }}>{t('platform:store.notFoundTitle')}</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('platform:store.notFoundSubtitle')}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>{t('platform:store.backToShop')}</button>
      </div>
    );
  }

  if (!store) return <div className="animate-fade">{t('common:loading')}</div>;

  const open = isOpenNow(store.operatingHours);

  return (
    <div className="animate-fade" style={{ paddingBottom: '40px' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{t('product:breadcrumb.home')}</Link>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{store.name}</span>
      </nav>

      {store.hasBanner && (
        <div style={{ width: '100%', height: '160px', borderRadius: '20px', overflow: 'hidden', marginBottom: '-40px' }}>
          <img src={buildStoreBannerUrl(slug)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '28px', marginTop: store.hasBanner ? '40px' : 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'white', border: '2px solid var(--accent-light)', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {store.hasLogo ? <img src={buildStoreLogoUrl(slug)} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Store size={26} color="var(--accent-primary)" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{store.name}</h1>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '3px 9px', borderRadius: '999px' }}>
                <BadgeCheck size={12} /> {t('platform:verifiedSeller')}
              </span>
            </div>
            {store.district && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                <MapPin size={13} /> {store.district}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          {(store.phones || []).map((phone) => (
            <a key={phone} href={`tel:${phone}`} className="btn-secondary" style={{ textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>
              <Phone size={14} /> {phone}
            </a>
          ))}
          {store.whatsapp && (
            <a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#128037', color: 'white', textDecoration: 'none', padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}>
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
        </div>

        {store.operatingHours?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Clock size={14} color="var(--accent-primary)" />
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', color: open ? '#10b981' : '#e74c3c', background: open ? 'rgba(16,185,129,0.12)' : 'rgba(231,76,60,0.12)' }}>
              {open ? t('contact:openNow') : t('contact:closedNow')}
            </span>
          </div>
        )}
      </div>

      {localizedPick(store.aboutText, i18n.language) && (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>{t('platform:store.aboutHeading')}</h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{localizedPick(store.aboutText, i18n.language)}</p>
        </div>
      )}

      <h2 className="page-title" style={{ marginBottom: '16px' }}>{t('platform:store.productsHeading', { seller: store.name })}</h2>

      {presentCategories.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px' }}>
          {['', ...presentCategories].map((c) => {
            const active = c === categoryFilter;
            return (
              <button
                key={c || 'all'} type="button" onClick={() => setCategoryFilter(c)} aria-pressed={active}
                style={{
                  flexShrink: 0, padding: '8px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--border-light)', whiteSpace: 'nowrap',
                  background: active ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-secondary)',
                  color: active ? 'white' : 'var(--text-muted)',
                }}
              >
                {c || t('platform:store.allCategories', { defaultValue: 'All' })}
              </button>
            );
          })}
        </div>
      )}

      <ProductGrid products={filtered} loading={loading} onCardClick={(p) => navigate(`/product/${p._id}`)} onAddToCart={addToCart} />
    </div>
  );
}
