import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Search, ArrowRight, ShieldCheck, Truck, CheckCircle, Zap, Package, Store, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import ProductGrid from '../components/product/ProductGrid';
import VehiclePicker from '../components/VehiclePicker';
import { getListings, getCategoryTree } from '../api/marketplaceServices';
import { normalizeListing, listingFitsVehicle, localizedPick } from '../api/marketplaceAdapters';
import useSelectedVehicle from '../hooks/useSelectedVehicle';
import useDocumentMeta from '../hooks/useDocumentMeta';
import InstallCard from '../components/InstallCard';

// Milestone 5 Part D.1 — home page in marketplace mode: real category
// tree, a vehicle picker, latest listings, and featured stores (derived
// from the latest listings' real sellers — there's no dedicated
// "featured stores" endpoint yet, so this is the simplest honest
// approximation rather than inventing fake curation).
export default function StorefrontPageMarketplace() {
  const { t, i18n } = useTranslation(['product', 'common', 'platform', 'marketplace']);
  // Follow-up #2 — platform:homeMetaDescription ("...genuine vehicle
  // parts...") is the same unverifiable-guarantee pattern already fixed
  // elsewhere on this page; marketplace:homeMetaDescription replaces it
  // here only. pos mode's StorefrontPagePos.jsx keeps reading the original.
  useDocumentMeta(t('platform:homeMetaTitle'), t('marketplace:homeMetaDescription'));
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { vehicle } = useSelectedVehicle();

  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchHome = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: catData }, { data: listData }] = await Promise.all([
        getCategoryTree(),
        getListings({ sort: 'newest', limit: 12 }),
      ]);
      setCategories(catData.tree || []);
      setListings(listData.listings || []);
    } catch {
      toast.error(t('catalog.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchHome(); }, [fetchHome]);

  const products = listings.map((l) => normalizeListing(l, { lang: i18n.language }));
  const featuredStores = [...new Map(listings.filter((l) => l.seller?.slug).map((l) => [l.seller.slug, l.seller])).values()].slice(0, 4);

  const handleVehicleSelected = () => navigate('/search');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="animate-fade">
      {/* Hero */}
      <div style={{
        background: 'var(--hero-gradient)', borderRadius: '20px', padding: '48px 40px', color: 'white',
        marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '32px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ maxWidth: '560px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
            <Zap size={13} /> {t('hero.badge')}
          </div>
          {/* Follow-up #2 — pos mode's hero.titleLine1/2 ("Genuine Parts,")
              and platform:heroSubtitle ("...warranty guaranteed") are the
              same unverifiable-guarantee pattern flagged for the footer/
              trust badges, just in the single most prominent spot on the
              page. Marketplace-only keys below instead of the shared ones;
              pos mode's StorefrontPagePos.jsx keeps reading the originals. */}
          <h2 style={{ fontSize: '34px', fontWeight: 900, marginBottom: '14px', lineHeight: 1.15 }}>
            {t('marketplace:hero.titleLine1')}<br />{t('marketplace:hero.titleLine2')}
          </h2>
          <p style={{ fontSize: '15px', opacity: 0.92, marginBottom: '24px', lineHeight: 1.7, maxWidth: '460px' }}>
            {t('marketplace:hero.subtitle')}
          </p>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', maxWidth: '420px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t('marketplace:search.placeholder')}
                style={{ width: '100%', padding: '12px 14px 12px 36px', borderRadius: '12px', border: 'none', fontSize: '14px' }}
              />
            </div>
            <button type="submit" style={{ background: 'white', color: '#ab550d', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {t('marketplace:search.go')} <ArrowRight size={14} />
            </button>
          </form>
        </div>
        {/* Follow-up #2 — "Genuine OEM Parts"/"Warranty Guaranteed" (product.json's
            hero.* keys, shared with pos mode) are claims Apexora can't back for every
            third-party seller's listing. Marketplace-only keys below use wording
            that's true today instead; pos mode's own StorefrontPage.jsx still reads
            product.json's hero.* unchanged. */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {[
            { icon: ShieldCheck, label: t('marketplace:hero.qualityChecked'), sub: t('marketplace:hero.qualityCheckedSub') },
            { icon: Truck, label: t('hero.islandwide'), sub: t('hero.delivery') },
            { icon: CheckCircle, label: t('marketplace:hero.warrantyAsStated'), sub: t('marketplace:hero.warrantyAsStatedSub') },
          ].map((item) => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '20px 18px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)', minWidth: '110px' }}>
              <item.icon size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: '14px', fontWeight: 800 }}>{item.label}</div>
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <InstallCard />

      {/* Shop by vehicle */}
      <div className="glass-card" style={{ padding: '22px 24px', borderRadius: '18px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
          {t('marketplace:vehiclePicker.heading')}
        </h2>
        <VehiclePicker initial={vehicle} onSelect={handleVehicleSelected} />
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>{t('marketplace:home.categoriesHeading')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {categories.map((node) => (
              <Link
                key={node.id} to={`/category/${node.slug}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  padding: '18px 12px', borderRadius: '14px', textDecoration: 'none',
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)', textAlign: 'center',
                }}
              >
                <Package size={24} color="var(--accent-primary)" />
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>{localizedPick(node.name, i18n.language)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Latest listings */}
      <div id="catalog" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{t('marketplace:home.latestHeading')}</h2>
        {/* Follow-up #3 — never show "0 parts available" while still loading;
            a real 0 only ever appears once `listings` has actually arrived. */}
        {loading ? (
          <div style={{
            height: '16px', width: '150px', borderRadius: '10px', background: 'var(--bg-card)',
            backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: '16px',
          }} />
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>{t('catalog.count', { count: products.length })}</p>
        )}
      </div>
      <ProductGrid
        products={products}
        loading={loading}
        onCardClick={(p) => navigate(`/product/${p._id}`)}
        onAddToCart={addToCart}
        getFitmentBadge={(p) => (vehicle ? (listingFitsVehicle(p.__fitment, vehicle) ? 'fits' : (p.__fitment?.length ? 'check' : undefined)) : undefined)}
      />

      {/* Featured stores */}
      {featuredStores.length > 0 && (
        <div style={{ marginTop: '48px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>{t('marketplace:home.storesHeading')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
            {featuredStores.map((s) => (
              <Link key={s.slug} to={`/store/${s.slug}`} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '14px', textDecoration: 'none' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Store size={19} color="var(--accent-primary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Follow-up #4 — single-line ellipsis was truncating longer
                      store names ("Mudiyanse Aut…"); let it wrap to 2 lines
                      instead (same fix covers long Sinhala/Tamil names). */}
                  <div style={{
                    fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3,
                  }}>
                    {s.displayName || s.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.district}</div>
                </div>
                <ChevronRight size={14} color="var(--text-muted)" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
