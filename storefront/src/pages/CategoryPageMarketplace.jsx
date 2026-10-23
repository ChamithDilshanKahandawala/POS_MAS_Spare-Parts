import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, SlidersHorizontal, X, Check, AlertTriangle, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getListings, getCategoryTree } from '../api/marketplaceServices';
import { normalizeListing, listingFitsVehicle, localizedPick } from '../api/marketplaceAdapters';
import { useCart } from '../context/CartContext';
import useIsMobile from '../hooks/useIsMobile';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import useSelectedVehicle from '../hooks/useSelectedVehicle';
import ProductGrid from '../components/product/ProductGrid';
import VehicleFilterBar from '../components/VehicleFilterBar';
import VehiclePicker from '../components/VehiclePicker';
import { PLATFORM_INFO } from '../config/store';
import { formatLKR } from '../utils/formatLKR';

const DEFAULT_TITLE = `${PLATFORM_INFO.name} | Vehicle Parts Marketplace in Sri Lanka`;

function SkeletonBar({ height, width }) {
  return (
    <div style={{
      height, width: width || '100%', borderRadius: '10px', background: 'var(--bg-card)',
      backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  );
}

function flattenCategories(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    flattenCategories(node.children || [], out);
  }
  return out;
}

// Milestone 5 Part D.2/D.4 — server-side filters/facets/pagination
// (replacing CategoryPagePos.jsx's client-side filtering) plus the
// vehicle filter bar.
export default function CategoryPageMarketplace() {
  const { t, i18n } = useTranslation(['category', 'common', 'marketplace']);
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile(1024);
  const reducedMotion = usePrefersReducedMotion();
  const { addToCart } = useCart();
  const { vehicle, select: selectVehicle, clear: clearVehicle } = useSelectedVehicle();

  const [allCategories, setAllCategories] = useState([]);
  const [result, setResult] = useState(null);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);

  const sort = searchParams.get('sort') || 'newest';
  const brand = searchParams.get('brand') || '';
  const condition = searchParams.get('condition') || '';
  const priceMin = searchParams.get('priceMin') || '';
  const priceMax = searchParams.get('priceMax') || '';
  const page = Number(searchParams.get('page') || 1);

  useEffect(() => {
    getCategoryTree().then(({ data }) => setAllCategories(flattenCategories(data.tree || []))).catch(() => {});
  }, []);

  // A pure derivation of allCategories+slug, not its own state — avoids
  // needing a second effect that would just be setState-syncing one piece
  // of state from another.
  const category = useMemo(() => allCategories.find((c) => c.slug === slug) || null, [allCategories, slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (allCategories.length > 0) setLoadStatus(category ? 'loading' : 'notfound');
  }, [allCategories, category]);

  const load = useCallback(() => {
    if (!category) return;
    setLoadStatus('loading');
    const params = {
      category: category.id, sort, page, limit: 24,
      brand: brand || undefined,
      condition: condition || undefined,
      priceMin: priceMin ? Number(priceMin) * 100 : undefined,
      priceMax: priceMax ? Number(priceMax) * 100 : undefined,
    };
    if (vehicle) {
      params.make = vehicle.makeId;
      params.model = vehicle.modelName;
      if (vehicle.year) params.year = vehicle.year;
    }
    getListings(params)
      .then(({ data }) => { setResult(data); setLoadStatus('ready'); })
      .catch(() => setLoadStatus('error'));
  }, [category, sort, brand, condition, priceMin, priceMax, page, vehicle]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  useEffect(() => {
    if (!category) return;
    document.title = `${localizedPick(category.name, i18n.language)} | ${PLATFORM_INFO.name}`;
    return () => { document.title = DEFAULT_TITLE; };
  }, [category, i18n.language]);

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const products = useMemo(() => (result?.listings || []).map((l) => normalizeListing(l, { lang: i18n.language, categoryName: category ? localizedPick(category.name, i18n.language) : '' })), [result, i18n.language, category]);
  const activeFilterCount = (brand ? 1 : 0) + (condition ? 1 : 0) + (priceMin || priceMax ? 1 : 0) + (sort !== 'newest' ? 1 : 0);
  const clearAll = () => setSearchParams(new URLSearchParams(), { replace: true });

  if (loadStatus === 'notfound') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <Package size={36} style={{ opacity: 0.35, color: 'var(--text-muted)' }} />
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginTop: '16px' }}>{t('notFound.title')}</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('notFound.subtitle')}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>{t('common:nav.backToStore')}</button>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <AlertTriangle size={36} style={{ opacity: 0.35, color: 'var(--accent-red)' }} />
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginTop: '16px' }}>{t('error.title')}</p>
        <button className="btn-primary" onClick={load}>{t('actions.tryAgain')}</button>
      </div>
    );
  }

  const toolbarContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="category-sort" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('toolbar.sort')}</label>
        <select id="category-sort" className="select-field" value={sort} onChange={(e) => updateParams({ sort: e.target.value === 'newest' ? null : e.target.value })} style={{ width: 'auto', borderRadius: '10px', fontSize: '13px' }}>
          <option value="newest">{t('toolbar.sortOptions.featured')}</option>
          <option value="price_asc">{t('toolbar.sortOptions.price_asc')}</option>
          <option value="price_desc">{t('toolbar.sortOptions.price_desc')}</option>
        </select>
      </div>

      {result?.facets?.conditions?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('marketplace:category.condition')}:</span>
          {result.facets.conditions.map((c) => (
            <button
              key={c.value} type="button" onClick={() => updateParams({ condition: condition === c.value ? null : c.value })}
              aria-pressed={condition === c.value}
              style={chipStyle(condition === c.value)}
            >
              {t(`marketplace:category.conditions.${c.value}`)} ({c.count})
            </button>
          ))}
        </div>
      )}

      {result?.facets?.brands?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('toolbar.brand')}:</span>
          {result.facets.brands.slice(0, 10).map((b) => (
            <button key={b.value} type="button" onClick={() => updateParams({ brand: brand === b.value ? null : b.value })} aria-pressed={brand === b.value} style={chipStyle(brand === b.value)}>
              {b.value} ({b.count})
            </button>
          ))}
        </div>
      )}

      {result?.facets?.priceRanges?.some((r) => r.count > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('marketplace:category.price')}:</span>
          {result.facets.priceRanges.filter((r) => r.count > 0).map((r) => {
            const active = priceMin === String(r.min / 100) && (priceMax === String((r.max ?? 0) / 100) || (!r.max && priceMax === ''));
            return (
              <button
                key={`${r.min}-${r.max}`} type="button" aria-pressed={active}
                onClick={() => updateParams(active ? { priceMin: null, priceMax: null } : { priceMin: r.min / 100, priceMax: r.max ? r.max / 100 : null })}
                style={chipStyle(active)}
              >
                {/* facets.priceRanges arrives in cents (same unit as priceCents
                    everywhere else in the public API) — formatLKR expects plain
                    rupees, so these must be divided by 100 before formatting,
                    the same conversion already applied to the click handler's
                    priceMin/priceMax above. Missing it here showed "Rs.
                    100,000.00" for a Rs. 1,000 bucket. */}
                {r.max ? `${formatLKR(r.min / 100)} – ${formatLKR(r.max / 100)}` : `${formatLKR(r.min / 100)}+`} ({r.count})
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="animate-fade">
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{t('breadcrumb.home')}</Link>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{category ? localizedPick(category.name, i18n.language) : ''}</span>
      </nav>

      {loadStatus === 'loading' && !result ? (
        <SkeletonBar height={32} width="240px" />
      ) : (
        <>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>{category ? localizedPick(category.name, i18n.language) : ''}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>{t('productCount', { count: result?.total ?? 0 })}</p>
        </>
      )}

      {vehiclePickerOpen ? (
        <div className="glass-card" style={{ padding: '18px', borderRadius: '14px', marginBottom: '16px' }}>
          <VehiclePicker initial={vehicle} onSelect={(v) => { selectVehicle(v); setVehiclePickerOpen(false); }} />
        </div>
      ) : (
        <VehicleFilterBar vehicle={vehicle} onChange={() => setVehiclePickerOpen(true)} onClear={clearVehicle} />
      )}

      {isMobile ? (
        <button type="button" onClick={() => setFiltersOpen(true)} className="btn-secondary" style={{ marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={15} /> {t('toolbar.filters')}
          {activeFilterCount > 0 && <span style={{ background: 'var(--accent-primary)', color: 'white', fontSize: '11px', fontWeight: 800, borderRadius: '999px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{activeFilterCount}</span>}
        </button>
      ) : (
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', padding: '14px 20px', borderRadius: '16px', marginBottom: '20px' }}>
          {toolbarContent}
        </div>
      )}

      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button onClick={clearAll} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
            {t('toolbar.clearAll')}
          </button>
        </div>
      )}

      {loadStatus === 'loading' ? (
        <ProductGrid products={[]} loading onAddToCart={addToCart} />
      ) : products.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <Package size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} />
          <p style={{ fontWeight: 600, fontSize: '15px' }}>{t('empty.title')}</p>
          <button className="btn-primary" style={{ marginTop: '12px' }} onClick={clearAll}>{t('empty.cta')}</button>
        </div>
      ) : (
        <>
          <ProductGrid
            products={products}
            loading={false}
            onCardClick={(p) => navigate(`/product/${p._id}`)}
            onAddToCart={addToCart}
            getFitmentBadge={(p) => (vehicle ? (listingFitsVehicle(p.__fitment, vehicle) ? 'fits' : (p.__fitment?.length ? 'check' : undefined)) : undefined)}
          />
          {result && page < result.pages && (
            <div style={{ textAlign: 'center', marginTop: '8px', paddingBottom: '40px' }}>
              <button className="btn-secondary" onClick={() => updateParams({ page: page + 1 })}>
                {t('loadMore', { count: result.total - products.length })}
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {isMobile && filtersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={() => setFiltersOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            />
            <motion.div
              role="dialog" aria-modal="true" aria-label={t('toolbar.filters')}
              initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
              animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
              transition={reducedMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
              style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001, maxHeight: '80vh', background: 'var(--bg-card)', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '999px', background: 'var(--border)' }} />
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('toolbar.filters')}</h2>
                <button onClick={() => setFiltersOpen(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {toolbarContent}
              </div>
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-light)' }}>
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setFiltersOpen(false)}>
                  <Check size={14} /> {t('toolbar.applyFilters')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function chipStyle(active) {
  return {
    padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', border: '1px solid var(--border-light)',
    background: active ? 'var(--accent-light)' : 'var(--bg-secondary)',
    color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
  };
}
