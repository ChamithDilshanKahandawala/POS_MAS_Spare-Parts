import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Package, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyOrders, getMyPosStatus } from '../../api/services';
import { formatLKR } from '../../utils/formatLKR';
import { formatDate } from '../../utils/formatDateTime';
import EmptyState from '../../components/EmptyState';

const TABS = ['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const STATUS_BADGE = {
  new: 'badge-yellow', confirmed: 'badge-blue', packed: 'badge-blue',
  shipped: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red', delivery_failed: 'badge-red', returned: 'badge-red',
};

// Milestone 6 Part E — Seller Center's order list, replacing the empty
// state. Tabs/counts/search/date filter all come straight from the
// backend (controllers/sellerOrdersController.js's listOrders) — nothing
// here recomputes a count client-side.
export default function OrdersPage() {
  const { t } = useTranslation(['seller', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posEnabled, setPosEnabled] = useState(false);

  const tab = searchParams.get('status') || 'new';
  const search = searchParams.get('search') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const page = Number(searchParams.get('page') || 1);
  // Follow-up — cross-cuts the Shipped/Delivered tabs rather than being
  // its own tab, so it's a separate toggle, not one of TABS.
  const notRecordedInPos = searchParams.get('notRecordedInPos') === 'true';

  const load = useCallback(() => {
    setLoading(true);
    getMyOrders({
      status: tab, search: search || undefined, from: from || undefined, to: to || undefined, page, limit: 20,
      notRecordedInPos: notRecordedInPos || undefined,
    })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [tab, search, from, to, page, notRecordedInPos, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // "Import from POS"-style conditional — getMyPosStatus never 404s, it
  // just reports enabled: false for a non-connected seller, so this
  // filter simply never shows for them rather than always being visible
  // and always returning zero results.
  useEffect(() => {
    getMyPosStatus().then(({ data }) => setPosEnabled(data.enabled)).catch(() => {});
  }, []);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('nav.orders')}</h1>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>
        {TABS.map((key) => (
          <button
            key={key}
            className={tab === key && !notRecordedInPos ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 14px', fontSize: '12px' }}
            onClick={() => { updateParam('status', key); updateParam('notRecordedInPos', ''); }}
          >
            {t(`orders.tabs.${key}`)} {result ? `(${result.counts[key]})` : ''}
          </button>
        ))}
      </div>

      {posEnabled && (
        <button
          className={notRecordedInPos ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '7px 14px', fontSize: '12px', marginBottom: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={() => updateParam('notRecordedInPos', notRecordedInPos ? '' : 'true')}
        >
          <AlertCircle size={13} /> {t('orders.notRecordedInPos')} {result ? `(${result.notRecordedInPosCount})` : ''}
        </button>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="console-search" style={{ maxWidth: '320px' }}>
          <Search size={14} />
          <input
            type="text" placeholder={t('orders.searchPlaceholder')} defaultValue={search}
            onKeyDown={(e) => { if (e.key === 'Enter') updateParam('search', e.currentTarget.value); }}
            onBlur={(e) => updateParam('search', e.currentTarget.value)}
          />
        </div>
        <input type="date" className="input-field" value={from} onChange={(e) => updateParam('from', e.target.value)} style={{ width: 'auto' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('orders.dateTo')}</span>
        <input type="date" className="input-field" value={to} onChange={(e) => updateParam('to', e.target.value)} style={{ width: 'auto' }} />
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : result.orders.length === 0 ? (
        <EmptyState icon={Package} title={t('orders.noResults')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('orders.table.orderNumber')}</th>
                <th>{t('orders.table.date')}</th>
                <th>{t('orders.table.items')}</th>
                <th>{t('orders.table.codAmount')}</th>
                <th>{t('orders.table.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.orders.map((order) => (
                <tr key={order._id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{order.orderNumber}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(order.createdAt)}</td>
                  <td>{order.items.length}</td>
                  <td style={{ fontWeight: 700 }}>{formatLKR(order.codAmountCents)}</td>
                  <td><span className={`badge ${STATUS_BADGE[order.status]}`}>{t(`orders.tabs.${order.status}`)}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} to={`/seller/orders/${order._id}`}>
                      {t('orders.view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('products.pagination', { page: result.page, pages: result.pages })}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" disabled={page <= 1} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page - 1))}><ChevronLeft size={14} /></button>
              <button className="btn-secondary" disabled={page >= result.pages} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page + 1))}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
