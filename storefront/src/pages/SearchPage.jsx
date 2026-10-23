import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, ChevronRight, Package, AlertTriangle } from 'lucide-react';
import { getListings } from '../api/marketplaceServices';
import { normalizeListing, listingFitsVehicle } from '../api/marketplaceAdapters';
import { useCart } from '../context/CartContext';
import useSelectedVehicle from '../hooks/useSelectedVehicle';
import ProductGrid from '../components/product/ProductGrid';
import VehicleFilterBar from '../components/VehicleFilterBar';
import VehiclePicker from '../components/VehiclePicker';
import { PLATFORM_INFO } from '../config/store';

function SkeletonBar({ height, width }) {
  return (
    <div style={{
      height, width: width || '100%', borderRadius: '10px', background: 'var(--bg-card)',
      backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  );
}

// Milestone 5 Part D.3 — marketplace-only (no pos equivalent). /search?q=
export default function SearchPage() {
  const { t, i18n } = useTranslation(['category', 'common', 'marketplace']);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { vehicle, select: selectVehicle, clear: clearVehicle } = useSelectedVehicle();

  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || '';
  const page = Number(searchParams.get('page') || 1);
  const [input, setInput] = useState(q);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('ready');
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => { document.title = q ? `"${q}" | ${PLATFORM_INFO.name}` : `${t('marketplace:search.title')} | ${PLATFORM_INFO.name}`; }, [q, t]);

  const load = useCallback(() => {
    setStatus('loading');
    const params = { page, limit: 24 };
    if (q) params.q = q;
    if (sort) params.sort = sort;
    if (vehicle) {
      params.make = vehicle.makeId;
      params.model = vehicle.modelName;
      if (vehicle.year) params.year = vehicle.year;
    }
    getListings(params)
      .then(({ data }) => { setResult(data); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, [q, sort, page, vehicle]);

  useEffect(() => { load(); }, [load]);

  const products = useMemo(() => (result?.listings || []).map((l) => normalizeListing(l, { lang: i18n.language })), [result, i18n.language]);

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const submitSearch = (e) => {
    e.preventDefault();
    updateParams({ q: input.trim() || null });
  };

  return (
    <div className="animate-fade">
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{t('breadcrumb.home')}</Link>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('marketplace:search.title')}</span>
      </nav>

      <form onSubmit={submitSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px', maxWidth: '520px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text" className="input-field" style={{ width: '100%', paddingLeft: '36px' }}
            value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('marketplace:search.placeholder')}
          />
        </div>
        <button type="submit" className="btn-primary">{t('marketplace:search.go')}</button>
      </form>

      <h1 className="page-title" style={{ marginBottom: '4px', fontSize: '20px' }}>
        {q ? t('marketplace:search.resultsFor', { query: q }) : t('marketplace:search.title')}
      </h1>
      {/* Follow-up #3 — never show "0 results" while still loading; a
          real 0 only ever appears once `result` has actually arrived. */}
      {status === 'loading' && !result ? (
        <div style={{ marginBottom: '20px' }}><SkeletonBar height={16} width="140px" /></div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>{t('productCount', { count: result?.total ?? 0 })}</p>
      )}

      {vehiclePickerOpen ? (
        <div className="glass-card" style={{ padding: '18px', borderRadius: '14px', marginBottom: '16px' }}>
          <VehiclePicker initial={vehicle} onSelect={(v) => { selectVehicle(v); setVehiclePickerOpen(false); }} />
        </div>
      ) : (
        <VehicleFilterBar vehicle={vehicle} onChange={() => setVehiclePickerOpen(true)} onClear={clearVehicle} />
      )}

      {status === 'error' ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <AlertTriangle size={36} style={{ opacity: 0.35, color: 'var(--accent-red)', margin: '0 auto 16px', display: 'block' }} />
          <button className="btn-primary" onClick={load}>{t('actions.tryAgain')}</button>
        </div>
      ) : status === 'loading' ? (
        <ProductGrid products={[]} loading onAddToCart={addToCart} />
      ) : products.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <Package size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} />
          <p style={{ fontWeight: 600, fontSize: '15px' }}>{t('empty.title')}</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>{t('empty.subtitle')}</p>
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
    </div>
  );
}
