import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminReturns } from '../../api/services';
import { formatDate } from '../../utils/formatDateTime';
import EmptyState from '../../components/EmptyState';
import { ReturnStatusBadge } from '../../components/returns/ReturnParts';
import { RETURN_STATUSES } from '../../components/returns/returnConstants';

const PAGE_SIZE = 20;

// Platform review queue. Default view is everything still needing a
// platform decision or a refund action, oldest first (server-side sort).
export default function ReturnsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page') || 1);

  const load = useCallback(() => {
    setLoading(true);
    getAdminReturns({ status: status || undefined, page, limit: PAGE_SIZE })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [status, page, t]);

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
      <h1 className="page-title" style={{ marginBottom: '6px' }}>{t('nav.returnsDisputes', { ns: 'common' })}</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('returnsPage.subtitle')}</p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input-field" style={{ width: 'auto' }} value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">{t('returnsPage.queue')}</option>
          {RETURN_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`common:returns.status.${s}`)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : result.returns.length === 0 ? (
        <EmptyState icon={RotateCcw} title={t('returnsPage.empty')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('returnsPage.table.request')}</th>
                <th>{t('returnsPage.table.order')}</th>
                <th>{t('returnsPage.table.seller')}</th>
                <th>{t('returnsPage.table.reason')}</th>
                <th>{t('returnsPage.table.status')}</th>
                <th>{t('returnsPage.table.date')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.returns.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.requestNumber}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.orderNumber}</td>
                  <td style={{ fontSize: '12.5px' }}>{r.seller?.name || '—'}</td>
                  <td style={{ fontSize: '12.5px' }}>{t(`common:returns.reason.${r.reason}`)}</td>
                  <td><ReturnStatusBadge status={r.status} /></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} to={`/admin/returns-disputes/${r._id}`}>
                      {t('returnsPage.view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('returnsPage.pagination', { page, pages })}</span>
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
