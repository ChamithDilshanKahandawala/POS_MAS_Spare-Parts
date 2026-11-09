import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminCustomers } from '../../api/services';
import { formatDate } from '../../utils/formatDateTime';
import EmptyState from '../../components/EmptyState';

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page') || 1);
  const [query, setQuery] = useState(q);

  const load = useCallback(() => {
    setLoading(true);
    getAdminCustomers({ q: q || undefined, status: status || undefined, page, limit: PAGE_SIZE })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [q, status, page, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const pages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '6px' }}>{t('nav.customers', { ns: 'common' })}</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('customersPage.subtitle')}</p>

      <form
        style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}
        onSubmit={(e) => { e.preventDefault(); updateParam('q', query.trim()); }}
      >
        <input className="input-field" style={{ flex: '1 1 220px', maxWidth: '420px' }} placeholder={t('customersPage.search')} aria-label={t('customersPage.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input-field" style={{ width: 'auto', maxWidth: '100%' }} value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">{t('customersPage.allStatuses')}</option>
          <option value="active">{t('customersPage.status.active')}</option>
          <option value="deactivated">{t('customersPage.status.deactivated')}</option>
        </select>
        <button type="submit" className="btn-secondary">{t('customersPage.searchButton')}</button>
      </form>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : !result || result.customers.length === 0 ? (
        <EmptyState icon={Users} title={t('customersPage.empty')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('customersPage.table.name')}</th>
                <th>{t('customersPage.table.contact')}</th>
                <th>{t('customersPage.table.orders')}</th>
                <th>{t('customersPage.table.joined')}</th>
                <th>{t('customersPage.table.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.customers.map((c) => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 600, fontSize: '13px' }}>
                    {c.name}
                    {c.isSellerMember && <span className="badge badge-purple" style={{ marginLeft: '8px' }}>{t('customersPage.sellerBadge')}</span>}
                  </td>
                  <td style={{ fontSize: '12px' }}>
                    <div>{c.email}</div>
                    {c.phone && <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.phone}</div>}
                  </td>
                  <td style={{ fontSize: '12.5px' }}>
                    {c.orderCount}
                    {c.lastOrderAt && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('customersPage.lastOrder', { date: formatDate(c.lastOrderAt) })}</div>}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(c.createdAt)}</td>
                  <td>
                    <span className={`badge ${c.isActive ? 'badge-green' : 'badge-red'}`}>{t(`customersPage.status.${c.isActive ? 'active' : 'deactivated'}`)}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} to={`/admin/customers/${c._id}`}>{t('customersPage.view')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('customersPage.pagination', { page, pages, total: result.total })}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" disabled={page <= 1} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page - 1))}><ChevronLeft size={14} /></button>
              <button className="btn-secondary" disabled={page >= pages} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page + 1))}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
