import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
// `motion` is used via the <motion.div> member expression below; see the
// same eslint note as CartDrawer.jsx.
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, SlidersHorizontal, X, Check, AlertTriangle, Package } from 'lucide-react';
import { getProducts } from '../api/services';
import { useCart } from '../context/CartContext';
import useLiveStock from '../hooks/useLiveStock';
import useIsMobile from '../hooks/useIsMobile';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import ProductGrid from '../components/product/ProductGrid';
import { slugify } from '../utils/slugify';
import { categoryStrings } from '../strings/categoryStrings';
import { CATEGORIES } from '../config/store';

const SHOP_NAME = 'Mudiyanse Auto Solutions';
const DEFAULT_TITLE = 'Mudiyanse Auto Solutions · Spare Parts POS';
const PAGE_SIZE = 24;

function SkeletonBar({ height, width }) {
  return (
    <div style={{
      height, width: width || '100%', borderRadius: '10px', background: 'var(--bg-card)',
      backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  );
}

// Owns the "Load more" reveal count, keyed by the parent on the filter
// signature so it remounts (and visibleCount resets to PAGE_SIZE) fresh
// whenever sort/filters/category change — the same remount-on-key pattern
// as ProductDetailRoute/CategoryRoute, applied at a smaller scope here so
// only this subtree resets instead of the whole page. Avoids both
// react-hooks/set-state-in-effect (no sync setState in an effect) and
// react-hooks/refs (no ref access during render), which a naive
// ref-based "remember the previous signature" approach would trip.
function ResultsSection({ filtered, onCardClick, onAddToCart }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleProducts = filtered.slice(0, visibleCount);
  return (
    <>
      <ProductGrid products={visibleProducts} loading={false} onCardClick={onCardClick} onAddToCart={onAddToCart} />
      {visibleCount < filtered.length && (
        <div style={{ textAlign: 'center', marginTop: '8px', paddingBottom: '40px' }}>
          <button className="btn-secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            {categoryStrings.loadMore} ({filtered.length - visibleCount})
          </button>
        </div>
      )}
    </>
  );
}

export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile(1024);
  const reducedMotion = usePrefersReducedMotion();
  const { addToCart } = useCart();
  const liveStock = useLiveStock();

  // Resolve slug -> real category name against the real list (Step 0 finding #1).
  const category = useMemo(() => CATEGORIES.find((c) => slugify(c) === slug) || null, [slug]);

  const [allProducts, setAllProducts] = useState([]);
  const [loadStatus, setLoadStatus] = useState(category ? 'loading' : 'notfound'); // loading | ready | error | notfound
  const [retryKey, setRetryKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // URL is the source of truth for sort/filters — survives refresh, shareable, back/forward works.
  const sort = searchParams.get('sort') || 'featured';
  const inStock = searchParams.get('inStock') === '1';
  const selectedBrands = useMemo(() => (searchParams.get('brand') || '').split(',').filter(Boolean), [searchParams]);
  const selectedSubs = useMemo(() => (searchParams.get('sub') || '').split(',').filter(Boolean), [searchParams]);

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      const isEmpty = value == null || value === '' || value === false || (Array.isArray(value) && value.length === 0);
      if (isEmpty) next.delete(key);
      else next.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    // Individual filter tweaks replace the current history entry (standard
    // faceted-filter UX — otherwise every chip click would push a new
    // back-button stop). The *navigation* to this page in the first place
    // (from a pill/navbar/breadcrumb Link) is a normal push, handled by
    // react-router itself, so back still cleanly leaves the category page.
    setSearchParams(next, { replace: true });
  };

  const toggleInList = (key, list, value) => {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    updateParams({ [key]: next });
  };

  // The route renders this page with key={slug} (see App.jsx), so loadStatus's
  // own initial value already matches `category` fresh on every category
  // change — no synchronous reset needed here, just "fetch, then setState
  // from the result" (see the identical note in ProductDetailPage.jsx).
  useEffect(() => {
    if (!category) return;
    let active = true;
    getProducts({ category, limit: 500 })
      .then(({ data }) => { if (active) { setAllProducts(data.products || []); setLoadStatus('ready'); } })
      .catch(() => { if (active) setLoadStatus('error'); });
    return () => { active = false; };
  }, [category, retryKey]);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  useEffect(() => {
    if (!category) return;
    document.title = `${category} | ${SHOP_NAME}`;
    return () => { document.title = DEFAULT_TITLE; };
  }, [category]);

  // Live-patch stock so the "in stock only" filter and the badges react to
  // real-time stock_updated events, not just the snapshot from page load.
  const liveProducts = useMemo(() => allProducts.map((p) => (
    typeof liveStock[p._id] === 'number' ? { ...p, stock_quantity: liveStock[p._id] } : p
  )), [allProducts, liveStock]);

  const availableBrands = useMemo(() => [...new Set(liveProducts.map((p) => p.brand).filter(Boolean))].sort(), [liveProducts]);
  const availableSubs = useMemo(() => [...new Set(liveProducts.map((p) => p.sub_category).filter(Boolean))].sort(), [liveProducts]);

  const filtered = useMemo(() => {
    let list = liveProducts;
    if (inStock) list = list.filter((p) => p.stock_quantity > 0);
    if (selectedBrands.length) list = list.filter((p) => selectedBrands.includes(p.brand));
    if (selectedSubs.length) list = list.filter((p) => selectedSubs.includes(p.sub_category));
    const sorted = [...list];
    if (sort === 'price_asc') sorted.sort((a, b) => a.selling_price - b.selling_price);
    else if (sort === 'price_desc') sorted.sort((a, b) => b.selling_price - a.selling_price);
    else if (sort === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
    // 'featured' — keep the server's own order (most-recently-updated first).
    return sorted;
  }, [liveProducts, inStock, selectedBrands, selectedSubs, sort]);

  // Identifies the current filter combination — passed as ResultsSection's
  // key so its "Load more" reveal count remounts back to PAGE_SIZE whenever
  // this changes (see ResultsSection above for why it's a key, not a ref).
  const filterSignature = `${category}|${sort}|${inStock}|${selectedBrands.join(',')}|${selectedSubs.join(',')}`;
  const activeFilterCount = selectedBrands.length + selectedSubs.length + (inStock ? 1 : 0) + (sort !== 'featured' ? 1 : 0);

  const clearAll = () => setSearchParams(new URLSearchParams(), { replace: true });

  if (loadStatus === 'notfound') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Package size={36} style={{ opacity: 0.35, color: 'var(--text-muted)' }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>{categoryStrings.notFound.title}</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>{categoryStrings.notFound.subtitle}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '480px', margin: '0 auto' }}>
          {CATEGORIES.map((c) => (
            <Link key={c} to={`/category/${slugify(c)}`} className="badge badge-blue" style={{ textDecoration: 'none' }}>{c}</Link>
          ))}
        </div>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertTriangle size={36} style={{ opacity: 0.35, color: 'var(--accent-red)' }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>{categoryStrings.error.title}</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>{categoryStrings.error.subtitle}</p>
        <button className="btn-primary" onClick={() => { setLoadStatus('loading'); setRetryKey((k) => k + 1); }}>{categoryStrings.actions.tryAgain}</button>
      </div>
    );
  }

  const toolbarContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="cat-sort" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{categoryStrings.toolbar.sort}</label>
        <select
          id="cat-sort"
          className="select-field"
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value === 'featured' ? null : e.target.value })}
          style={{ width: 'auto', borderRadius: '10px', padding: '8px 10px', fontSize: '13px' }}
        >
          {Object.entries(categoryStrings.toolbar.sortOptions).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => updateParams({ inStock: inStock ? null : '1' })}
        aria-pressed={inStock}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '999px',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-light)',
          background: inStock ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-secondary)',
          color: inStock ? 'white' : 'var(--text-muted)',
        }}
      >
        {inStock && <Check size={13} />} {categoryStrings.toolbar.inStockOnly}
      </button>

      {availableBrands.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{categoryStrings.toolbar.brand}:</span>
          {availableBrands.map((b) => {
            const active = selectedBrands.includes(b);
            return (
              <button
                key={b}
                type="button"
                onClick={() => toggleInList('brand', selectedBrands, b)}
                aria-pressed={active}
                style={{
                  padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', border: '1px solid var(--border-light)',
                  background: active ? 'var(--accent-light)' : 'var(--bg-secondary)',
                  color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                {b}
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="animate-fade">
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{categoryStrings.breadcrumb.home}</Link>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{category}</span>
      </nav>

      {loadStatus === 'loading' ? (
        <SkeletonBar height={32} width="240px" />
      ) : (
        <>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>{category}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>{categoryStrings.productCount(filtered.length)}</p>
        </>
      )}

      {/* Sub-category chips — horizontally scrollable, only when the field
          actually has values for this category. */}
      {availableSubs.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
          {availableSubs.map((s) => {
            const active = selectedSubs.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleInList('sub', selectedSubs, s)}
                aria-pressed={active}
                style={{
                  flexShrink: 0, padding: '8px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', border: '1px solid var(--border-light)', whiteSpace: 'nowrap',
                  background: active ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-secondary)',
                  color: active ? 'white' : 'var(--text-muted)',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar: inline on desktop, a "Filters" button opening a bottom sheet on mobile */}
      {isMobile ? (
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="btn-secondary"
          style={{ marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <SlidersHorizontal size={15} /> {categoryStrings.toolbar.filters}
          {activeFilterCount > 0 && (
            <span style={{
              background: 'var(--accent-primary)', color: 'white', fontSize: '11px', fontWeight: 800,
              borderRadius: '999px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
            }}>{activeFilterCount}</span>
          )}
        </button>
      ) : (
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', padding: '14px 20px', borderRadius: '16px', marginBottom: '20px' }}>
          {toolbarContent}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {sort !== 'featured' && (
            <span className="badge badge-orange" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {categoryStrings.toolbar.sortOptions[sort]}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => updateParams({ sort: null })} />
            </span>
          )}
          {inStock && (
            <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {categoryStrings.toolbar.inStockOnly}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => updateParams({ inStock: null })} />
            </span>
          )}
          {selectedBrands.map((b) => (
            <span key={b} className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {b}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => toggleInList('brand', selectedBrands, b)} />
            </span>
          ))}
          {selectedSubs.map((s) => (
            <span key={s} className="badge badge-purple" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {s}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => toggleInList('sub', selectedSubs, s)} />
            </span>
          ))}
          <button onClick={clearAll} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
            {categoryStrings.toolbar.clearAll}
          </button>
        </div>
      )}

      {loadStatus === 'loading' ? (
        <ProductGrid products={[]} loading onAddToCart={addToCart} />
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <Package size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} />
          <p style={{ fontWeight: 600, fontSize: '15px' }}>{categoryStrings.empty.title}</p>
          <p style={{ fontSize: '13px', marginTop: '4px', marginBottom: '16px' }}>{categoryStrings.empty.subtitle}</p>
          <button className="btn-primary" onClick={clearAll}>{categoryStrings.empty.cta}</button>
        </div>
      ) : (
        <ResultsSection
          key={filterSignature}
          filtered={filtered}
          onCardClick={(p) => navigate(`/product/${p._id}`)}
          onAddToCart={addToCart}
        />
      )}

      {/* Mobile filters bottom sheet — same visual pattern as CartDrawer's
          mobile sheet (rounded top, drag handle, backdrop). */}
      <AnimatePresence>
        {isMobile && filtersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              onClick={() => setFiltersOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            />
            <motion.div
              role="dialog" aria-modal="true" aria-label={categoryStrings.toolbar.filters}
              initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
              animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
              transition={reducedMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
              style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001, maxHeight: '80vh',
                background: 'var(--bg-card)', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)', overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '999px', background: 'var(--border)' }} />
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{categoryStrings.toolbar.filters}</h2>
                <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {toolbarContent}
              </div>
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-light)' }}>
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setFiltersOpen(false)}>
                  {categoryStrings.toolbar.applyFilters}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
