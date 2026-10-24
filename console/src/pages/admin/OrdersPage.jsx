import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Package, Clock, AlertTriangle, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminOrders, getAdminOrdersOverview, getSellers } from '../../api/services';
import { formatLKR } from '../../utils/formatLKR';
import { formatDate } from '../../utils/formatDateTime';
import EmptyState from '../../components/EmptyState';

const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota',
  'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara',
  'Moneragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];
const STATUSES = ['new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const STATUS_BADGE = {
  new: 'badge-yellow', confirmed: 'badge-blue', packed: 'badge-blue',
  shipped: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red', delivery_failed: 'badge-red', returned: 'badge-red',
};

// Milestone 6 Part F — admin order oversight across every seller,
// replacing the empty state.
export default function OrdersPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [sellers, setSellers] = useState([]);

  const status = searchParams.get('status') || '';
  const seller = searchParams.get('seller') || '';
  const district = searchParams.get('district') || '';
  const search = searchParams.get('search') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const page = Number(searchParams.get('page') || 1);
  // Follow-up #2 — always empty today (every order is COD), ahead of
  // Milestone 7's online payments.
  const refundNeeded = searchParams.get('refundNeeded') === 'true';

  const load = useCallback(() => {
    setLoading(true);
    getAdminOrders({
      status: status || undefined, seller: seller || undefined, district: district || undefined,
      search: search || undefined, from: from || undefined, to: to || undefined, page, limit: 20,
      refundNeeded: refundNeeded || undefined,
    })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [status, seller, district, search, from, to, page, refundNeeded, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getAdminOrdersOverview().then(({ data }) => setOverview(data)).catch(() => {});
    getSellers({ limit: 200 }).then(({ data }) => setSellers(data.sellers || [])).catch(() => {});
  }, []);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('common:nav.orders')}</h1>

      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Package size={20} color="var(--accent-primary)" />
            <div><div style={{ fontSize: '20px', fontWeight: 800 }}>{overview.ordersToday}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('orders.overview.ordersToday')}</div></div>
          </div>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} color="#f59e0b" />
            <div><div style={{ fontSize: '20px', fontWeight: 800 }}>{overview.waitingConfirmation}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('orders.overview.waitingConfirmation')}</div></div>
          </div>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="#ef4444" />
            <div><div style={{ fontSize: '20px', fontWeight: 800 }}>{overview.deliveryFailures}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('orders.overview.deliveryFailures')}</div></div>
          </div>
          <Link to="/admin/orders?refundNeeded=true" className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
            <Banknote size={20} color="#ef4444" />
            <div><div style={{ fontSize: '20px', fontWeight: 800 }}>{overview.refundsNeeded}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('orders.overview.refundsNeeded')}</div></div>
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="console-search" style={{ maxWidth: '260px' }}>
          <Search size={14} />
          <input
            type="text" placeholder={t('orders.searchPlaceholder')} defaultValue={search}
            onKeyDown={(e) => { if (e.key === 'Enter') updateParam('search', e.currentTarget.value); }}
            onBlur={(e) => updateParam('search', e.currentTarget.value)}
          />
        </div>
        <select className="select-field" style={{ width: 'auto' }} value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">{t('orders.allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`orders.tabs.${s}`)}</option>)}
        </select>
        <select className="select-field" style={{ width: 'auto' }} value={seller} onChange={(e) => updateParam('seller', e.target.value)}>
          <option value="">{t('orders.allSellers')}</option>
          {sellers.map((s) => <option key={s._id} value={s._id}>{s.displayName || s.name}</option>)}
        </select>
        <select className="select-field" style={{ width: 'auto' }} value={district} onChange={(e) => updateParam('district', e.target.value)}>
          <option value="">{t('orders.allDistricts')}</option>
          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="date" className="input-field" value={from} onChange={(e) => updateParam('from', e.target.value)} style={{ width: 'auto' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('orders.dateTo')}</span>
        <input type="date" className="input-field" value={to} onChange={(e) => updateParam('to', e.target.value)} style={{ width: 'auto' }} />
        <button
          className={refundNeeded ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '7px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={() => updateParam('refundNeeded', refundNeeded ? '' : 'true')}
        >
          <Banknote size={13} /> {t('orders.refundNeededFilter')}
        </button>
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
                <th>{t('orders.table.seller')}</th>
                <th>{t('orders.table.date')}</th>
                <th>{t('orders.table.district')}</th>
                <th>{t('orders.table.codAmount')}</th>
                <th>{t('orders.table.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.orders.map((order) => (
                <tr key={order._id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{order.orderNumber}</td>
                  <td>{order.seller?.displayName || order.seller?.name}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(order.createdAt)}</td>
                  <td style={{ fontSize: '12px' }}>{order.shippingAddress?.district}</td>
                  <td style={{ fontWeight: 700 }}>{formatLKR(order.codAmountCents)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[order.status]}`}>{t(`orders.tabs.${order.status}`)}</span>
                    {order.refundNeeded && <span className="badge badge-red" style={{ marginLeft: '6px' }}>{t('orders.refundNeededBadge')}</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} to={`/admin/orders/${order._id}`}>{t('orders.view')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('orders.pagination', { page: result.page, pages: result.pages })}</span>
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
