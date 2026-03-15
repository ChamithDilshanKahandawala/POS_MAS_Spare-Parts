import { useEffect, useState, useCallback } from 'react';
import { getSales } from '../api/services'; // Ensure this can fetch all or we need a new endpoint
// We will reuse getSales but filter by sale_source=online 
import toast from 'react-hot-toast';
import { Truck, Package, CheckCircle, Clock } from 'lucide-react';
import api from '../api/axios'; // Direct api call to update status if needed

export default function WebOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOnlineOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSales({ sale_source: 'online', limit: 50 });
      setOrders(data.sales || []);
    } catch {
      toast.error('Failed to load web orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOnlineOrders(); }, [fetchOnlineOrders]);

  const updateStatus = async (id, newStatus) => {
    try {
      await api.put(`/sales/${id}/status`, { order_status: newStatus });
      toast.success('Order status updated');
      fetchOnlineOrders();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <Clock size={16} color="#f59e0b" />;
      case 'Processing': return <Package size={16} color="#3b82f6" />;
      case 'Shipped': return <Truck size={16} color="#8b5cf6" />;
      case 'Delivered': return <CheckCircle size={16} color="#10b981" />;
      default: return null;
    }
  };

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '24px' }}>Web Orders Management</h1>

      {loading ? (
         <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <p>No web orders found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {orders.map(o => (
            <div key={o._id} className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{o.invoice_number}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Customer: {o.customer_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Address: {o.shipping_address || 'Not Provided'}</div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Items ({o.items?.length})</div>
                {o.items?.map(i => (
                  <div key={i._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{i.quantity}x {i.product_name}</span>
                    <span style={{ fontWeight: 600 }}>Rs. {i.line_total.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '8px', fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--accent-primary)' }}>Rs. {o.total_amount.toLocaleString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</label>
                  <select 
                    className="select-field"
                    value={o.order_status || 'Pending'}
                    onChange={(e) => updateStatus(o._id, e.target.value)}
                    style={{ width: '100%', padding: '8px', fontSize: '12px', borderRadius: '8px' }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '16px' }}>
                  {getStatusIcon(o.order_status || 'Pending')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
