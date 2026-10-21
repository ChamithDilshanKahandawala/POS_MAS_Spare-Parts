import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, Download } from 'lucide-react';
import { getPosProducts, importPosProducts } from '../../api/services';
import EmptyState from '../../components/EmptyState';

export default function ImportFromPosPage() {
  const { t } = useTranslation(['seller', 'common']);
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [notImported, setNotImported] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getPosProducts({ search: search || undefined, category: category || undefined, notImported: notImported ? 'true' : undefined })
      .then(({ data }) => setProducts(data.products))
      .catch((err) => toast.error(err.response?.data?.message || t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [search, category, notImported, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    if (!products) return [];
    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  }, [products]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data } = await importPosProducts([...selected]);
      if (data.created.length > 0) toast.success(t('importFromPos.createdCount', { count: data.created.length }));
      if (data.skipped.length > 0) toast.error(t('importFromPos.skippedCount', { count: data.skipped.length }));
      setSelected(new Set());
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="animate-fade">
      <button className="btn-secondary" style={{ marginBottom: '16px', padding: '6px 12px', fontSize: '12px' }} onClick={() => navigate('/seller/products')}>
        <ArrowLeft size={14} /> {t('importFromPos.back')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title">{t('importFromPos.title')}</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('importFromPos.subtitle')}</div>
        </div>
        <button className="btn-primary" disabled={selected.size === 0 || importing} onClick={handleImport}>
          <Download size={14} /> {t('importFromPos.createDrafts', { count: selected.size })}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="console-search" style={{ maxWidth: '320px' }}>
          <Search size={14} />
          <input
            type="text"
            placeholder={t('importFromPos.searchPlaceholder')}
            defaultValue={search}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(e.currentTarget.value); }}
            onBlur={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
        <select className="select-field" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('importFromPos.allCategories')}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <input type="checkbox" checked={notImported} onChange={(e) => setNotImported(e.target.checked)} />
          {t('importFromPos.notImportedOnly')}
        </label>
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : products.length === 0 ? (
        <EmptyState title={t('importFromPos.noResults')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>{t('importFromPos.table.name')}</th>
                <th>{t('importFromPos.table.sku')}</th>
                <th>{t('importFromPos.table.category')}</th>
                <th>{t('importFromPos.table.price')}</th>
                <th>{t('importFromPos.table.stock')}</th>
                <th>{t('importFromPos.table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      disabled={!!p.linkedListing}
                      onChange={() => toggle(p.id)}
                    />
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.sku_code}</td>
                  <td>{p.category}</td>
                  <td>Rs {(p.selling_price / 100).toLocaleString()}</td>
                  <td>{p.stock_quantity}</td>
                  <td>
                    {p.linkedListing ? (
                      <Link className="badge badge-blue" to={`/seller/products/${p.linkedListing.id}/edit`}>
                        {t('importFromPos.linkedTo', { title: p.linkedListing.title || t('products.untitled') })}
                      </Link>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('importFromPos.notImported')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
