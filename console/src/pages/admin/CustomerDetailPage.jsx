import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAdminCustomer, deactivateAdminCustomer, reactivateAdminCustomer, sendAdminCustomerPasswordReset,
} from '../../api/services';
import { formatDate, formatDateTime } from '../../utils/formatDateTime';
import { formatLKR } from '../../utils/formatLKR';
import EmptyState from '../../components/EmptyState';
import { ReturnStatusBadge } from '../../components/returns/ReturnParts';

// Support view of one customer. Phones and street lines arrive masked from
// the API; there is no way to see or set a password from here.
export default function CustomerDetailPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getAdminCustomer(id)
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const run = async (fn, successKey) => {
    setBusy(true);
    try {
      await fn();
      toast.success(t(successKey));
      setReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!data) return <EmptyState icon={Users} title={t('customersPage.detail.notFound')} />;

  const { customer: c, stats, orders, returns } = data;

  return (
    <div className="animate-fade">
      <Link to="/admin/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <ArrowLeft size={14} /> {t('customersPage.detail.back')}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{c.name}</h1>
        <span className={`badge ${c.isActive ? 'badge-green' : 'badge-red'}`}>{t(`customersPage.status.${c.isActive ? 'active' : 'deactivated'}`)}</span>
        {c.isSellerMember && <span className="badge badge-purple">{t('customersPage.sellerBadge')}</span>}
      </div>

      <div className="detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          <div className="glass-card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <Stat label={t('customersPage.detail.orders')} value={stats.orderCount} />
            <Stat label={t('customersPage.detail.spent')} value={formatLKR(stats.totalCents)} />
            <Stat label={t('customersPage.detail.returns')} value={stats.returnCount} />
            <Stat label={t('customersPage.detail.joined')} value={formatDate(c.createdAt)} />
          </div>

          <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('customersPage.detail.ordersTitle')}</h2>
            {orders.length === 0 ? <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('customersPage.detail.noOrders')}</div> : (
              <table className="data-table">
                <thead><tr><th>{t('customersPage.detail.order')}</th><th>{t('customersPage.detail.date')}</th><th>{t('customersPage.detail.total')}</th><th>{t('customersPage.detail.parcels')}</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{o.orderNumber}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(o.createdAt)}</td>
                      <td style={{ fontSize: '12.5px', fontWeight: 700 }}>{formatLKR(o.grandTotalCents)}</td>
                      <td style={{ fontSize: '12px' }}>
                        {o.parcels.map((p) => (
                          <div key={p.orderNumber}>{p.seller} · {t(`orders.tabs.${p.status}`)}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('customersPage.detail.returnsTitle')}</h2>
            {returns.length === 0 ? <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('customersPage.detail.noReturns')}</div> : (
              <table className="data-table">
                <tbody>
                  {returns.map((r) => (
                    <tr key={r._id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}><Link to={`/admin/returns-disputes/${r._id}`}>{r.requestNumber}</Link></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.orderNumber}</td>
                      <td><ReturnStatusBadge status={r.status} /></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          <div className="glass-card" style={{ padding: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', wordBreak: 'break-word' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800 }}>{t('customersPage.detail.contact')}</h2>
            <div>{c.email}</div>
            <div style={{ fontFamily: 'monospace' }}>{c.phone || '—'}</div>
            <div style={{ color: 'var(--text-muted)' }}>{t('customersPage.detail.language')}: {c.preferredLanguage}</div>
            {c.addresses.length > 0 && <div style={{ fontWeight: 700, marginTop: '6px' }}>{t('customersPage.detail.addresses')}</div>}
            {c.addresses.map((a) => (
              <div key={a._id} style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                {a.label && <strong>{a.label}: </strong>}{a.line1}, {a.city}, {a.district} · <span style={{ fontFamily: 'monospace' }}>{a.phone}</span>
              </div>
            ))}
          </div>

          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800 }}>{t('customersPage.detail.accountTitle')}</h2>
            {!c.isActive && (
              <div style={{ fontSize: '12.5px' }}>
                {t('customersPage.detail.deactivatedOn', { date: formatDateTime(c.deactivatedAt) })}
                <div style={{ color: 'var(--text-muted)' }}>{c.deactivationReason}</div>
              </div>
            )}
            <textarea className="input-field" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('customersPage.detail.reasonPlaceholder')} aria-label={t('customersPage.detail.reasonPlaceholder')} />
            {c.isActive ? (
              <button className="btn-secondary" disabled={busy || reason.trim().length < 3} onClick={() => run(() => deactivateAdminCustomer(id, reason.trim()), 'customersPage.toast.deactivated')}>
                {t('customersPage.detail.deactivate')}
              </button>
            ) : (
              <button className="btn-primary" disabled={busy || reason.trim().length < 3} onClick={() => run(() => reactivateAdminCustomer(id, reason.trim()), 'customersPage.toast.reactivated')}>
                {t('customersPage.detail.reactivate')}
              </button>
            )}
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('customersPage.detail.deactivateHint')}</div>

            <button className="btn-secondary" style={{ marginTop: '8px' }} disabled={busy || !c.isActive} onClick={() => run(() => sendAdminCustomerPasswordReset(id), 'customersPage.toast.resetSent')}>
              {t('customersPage.detail.sendReset')}
            </button>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('customersPage.detail.sendResetHint')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px' }}>{value}</div>
    </div>
  );
}
