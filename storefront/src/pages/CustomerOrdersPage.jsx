import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMyOrders } from '../api/services';
import toast from 'react-hot-toast';
import { Package, Truck, Clock, CheckCircle, Navigation } from 'lucide-react';
import { formatLKR } from '../utils/formatLKR';
import { getSellerForProduct } from '../config/store';

// Every order today is fulfilled by the same single seller — see the
// identical note in OrderSuccessPage.jsx.
const orderSeller = getSellerForProduct();

export default function CustomerOrdersPage() {
  const { t } = useTranslation(['order', 'platform']);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await getMyOrders();
        setOrders(data);
      } catch {
        toast.error(t('list.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <Clock size={16} color="#f59e0b" />;
      case 'Processing': return <Package size={16} color="#3b82f6" />;
      case 'Shipped': return <Truck size={16} color="#8b5cf6" />;
      case 'Delivered': return <CheckCircle size={16} color="#10b981" />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'rgba(245, 158, 11, 0.1)';
      case 'Processing': return 'rgba(59, 130, 246, 0.1)';
      case 'Shipped': return 'rgba(139, 92, 246, 0.1)';
      case 'Delivered': return 'rgba(16, 185, 129, 0.1)';
      default: return 'var(--bg-secondary)';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'Pending': return '#f59e0b';
      case 'Processing': return '#3b82f6';
      case 'Shipped': return '#8b5cf6';
      case 'Delivered': return '#10b981';
      default: return 'var(--text-primary)';
    }
  };

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '24px' }}>{t('list.title')}</h1>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>{t('list.loading')}</div>
      ) : orders.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <Package size={48} style={{ opacity: 0.2, marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
          <p>{t('list.empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {orders.map(o => (
            <div key={o._id} className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{o.invoice_number}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {new Date(o.createdAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {t('platform:soldBy', { seller: orderSeller.name })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: getStatusColor(o.order_status || 'Pending'), padding: '6px 12px', borderRadius: '20px' }}>
                    {getStatusIcon(o.order_status || 'Pending')}
                    <span style={{ fontSize: '13px', fontWeight: 700, color: getStatusTextColor(o.order_status || 'Pending') }}>
                      {t(`status.${o.order_status || 'Pending'}`)}
                    </span>
                  </div>
                  {o.tracking_number && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <Navigation size={12} color="var(--accent-primary)" style={{ transform: 'rotate(45deg)' }} />
                      {t('list.tracking')} <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{o.tracking_number}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {o.items.map(item => (
                  <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} color="var(--text-muted)" />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('items.qtyLine', { count: item.quantity, price: formatLKR(item.selling_price) })}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatLKR(item.quantity * item.selling_price)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '24px', border: '1px solid var(--border-light)' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{t('list.paymentInfo')}</div>
                  {/* TODO: previously showed "Online / Card" for any non-'Cash' order, which
                      implied online payment had been taken — no payment gateway has ever
                      existed, so every order (including legacy ones recorded as 'Online')
                      is actually Cash on Delivery. Revisit once a real gateway exists. */}
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('list.cashOnDelivery')}</div>
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{t('list.contactNumber')}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{o.customer_phone || t('list.notAvailable')}</div>
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{t('list.storeAndDelivery')}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('list.standardShipping')}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('list.deliveryAddress')}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '300px' }}>{o.shipping_address || t('list.notAvailable')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('list.totalAmount')}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-primary)' }}>{formatLKR(o.total_amount)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
