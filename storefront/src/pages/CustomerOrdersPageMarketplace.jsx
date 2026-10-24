import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Package, Truck, Clock, CheckCircle, XCircle, Store, Navigation } from 'lucide-react';
import { getMyMarketplaceOrders, cancelMyMarketplaceOrder } from '../api/marketplaceServices';
import { formatLKR } from '../utils/formatLKR';

const CANCELLABLE_STATUSES = ['new', 'confirmed'];

const STATUS_ICON = {
  new: <Clock size={13} color="#f59e0b" />,
  confirmed: <CheckCircle size={13} color="#3b82f6" />,
  packed: <Package size={13} color="#8b5cf6" />,
  shipped: <Truck size={13} color="#8b5cf6" />,
  delivered: <CheckCircle size={13} color="#10b981" />,
  cancelled: <XCircle size={13} color="#ef4444" />,
  delivery_failed: <XCircle size={13} color="#ef4444" />,
};
const STATUS_BG = {
  new: 'rgba(245, 158, 11, 0.1)', confirmed: 'rgba(59, 130, 246, 0.1)', packed: 'rgba(139, 92, 246, 0.1)',
  shipped: 'rgba(139, 92, 246, 0.1)', delivered: 'rgba(16, 185, 129, 0.1)',
  cancelled: 'rgba(239, 68, 68, 0.1)', delivery_failed: 'rgba(239, 68, 68, 0.1)',
};
const STATUS_TEXT = {
  new: '#f59e0b', confirmed: '#3b82f6', packed: '#8b5cf6', shipped: '#8b5cf6',
  delivered: '#10b981', cancelled: '#ef4444', delivery_failed: '#ef4444',
};

// Milestone 6 Part C — "My orders" for marketplace mode: each order can
// have several seller parcels, each tracked (and cancelled) separately
// from the pos-mode single-seller equivalent (CustomerOrdersPagePos.jsx).
export default function CustomerOrdersPageMarketplace() {
  const { t } = useTranslation(['order', 'marketplace']);
  const [orders, setOrders] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(() => {
    getMyMarketplaceOrders().then(({ data }) => setOrders(data.orders)).catch(() => toast.error(t('list.failedToLoad')));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const cancelOrder = async (orderNumber) => {
    setCancellingId(orderNumber);
    try {
      await cancelMyMarketplaceOrder(orderNumber, {});
      toast.success(t('marketplaceItems.cancelled'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('marketplaceItems.cancelFailed'));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '24px' }}>{t('list.title')}</h1>

      {orders === null ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>{t('list.loading')}</div>
      ) : orders.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <Package size={48} style={{ opacity: 0.2, marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
          <p>{t('list.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {orders.map((o) => {
            const canCancel = o.sellerOrders.length > 0 && o.sellerOrders.every((so) => CANCELLABLE_STATUSES.includes(so.status));
            return (
              <div key={o._id} className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{o.orderNumber}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {new Date(o.createdAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('items.total')}</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)' }}>{formatLKR(o.grandTotalCents / 100)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {o.sellerOrders.map((so) => (
                    <div key={so._id} style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <Store size={13} color="var(--accent-primary)" /> {so.seller?.displayName || so.seller?.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: STATUS_BG[so.status], padding: '4px 10px', borderRadius: '20px' }}>
                          {STATUS_ICON[so.status]}
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: STATUS_TEXT[so.status] }}>{t(`marketplaceStatus.${so.status}`)}</span>
                        </div>
                      </div>
                      {so.trackingNumber && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          <Navigation size={11} color="var(--accent-primary)" style={{ transform: 'rotate(45deg)' }} />
                          {t('list.tracking')} <strong style={{ fontFamily: 'monospace' }}>{so.trackingNumber}</strong>
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {so.items.map((it) => `${it.title?.en} ×${it.qty}`).join(', ')}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12.5px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('marketplaceItems.codAmount')}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatLKR(so.codAmountCents / 100)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {canCancel && (
                  <button
                    className="btn-secondary" style={{ marginTop: '16px', fontSize: '12.5px' }}
                    disabled={cancellingId === o.orderNumber}
                    onClick={() => cancelOrder(o.orderNumber)}
                  >
                    {cancellingId === o.orderNumber ? t('marketplaceItems.cancelling') : t('marketplaceItems.cancelOrder')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
