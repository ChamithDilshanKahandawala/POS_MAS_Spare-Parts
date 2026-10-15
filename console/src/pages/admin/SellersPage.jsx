import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSellers } from '../../api/services';
import EmptyState from '../../components/EmptyState';

const STATUSES = ['in_review', 'active', 'suspended', 'closed'];
const STATUS_BADGE = { in_review: 'badge-yellow', active: 'badge-green', suspended: 'badge-orange', closed: 'badge-red' };

export default function SellersPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page') || 1);

  const load = useCallback(() => {
    setLoading(true);
    getSellers({ search: search || undefined, status: status || undefined, page, limit: 20 })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [search, status, page, t]);

  // load (useCallback) sets state internally, so the static analysis
  // flags this the same way as AuthContext.jsx's session-restore effect —
  // this is the same legitimate case: fetch once on mount/filter-change,
  // not a render-triggered setState cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('common:nav.sellers')}</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="console-search" style={{ maxWidth: '320px' }}>
          <Search size={14} />
          <input
            type="text"
            placeholder={t('sellers.searchPlaceholder')}
            defaultValue={search}
            onKeyDown={(e) => { if (e.key === 'Enter') updateParam('search', e.currentTarget.value); }}
            onBlur={(e) => updateParam('search', e.currentTarget.value)}
          />
        </div>
        <select className="select-field" style={{ width: 'auto' }} value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">{t('sellers.allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`sellers.status.${s}`)}</option>)}
        </select>
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : result.sellers.length === 0 ? (
        <EmptyState title={t('sellers.noResults')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('sellers.table.store')}</th>
                <th>{t('sellers.table.legalName')}</th>
                <th>{t('sellers.table.brNumber')}</th>
                <th>{t('sellers.table.district')}</th>
                <th>{t('sellers.table.status')}</th>
                <th>{t('sellers.table.joined')}</th>
                <th>{t('sellers.table.owner')}</th>
              </tr>
            </thead>
            <tbody>
              {result.sellers.map((s) => (
                <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/sellers/${s._id}`)}>
                  <td>{s.name}</td>
                  <td>{s.legalName}</td>
                  <td>{s.brNumber}</td>
                  <td>{s.district || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[s.status]}`}>{t(`sellers.status.${s.status}`)}</span></td>
                  <td>{dateFormatter.format(new Date(s.createdAt))}</td>
                  <td>{s.owner?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellers.pagination', { page: result.page, pages: result.pages })}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" disabled={page <= 1} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page - 1))}>
                <ChevronLeft size={14} />
              </button>
              <button className="btn-secondary" disabled={page >= result.pages} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page + 1))}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
