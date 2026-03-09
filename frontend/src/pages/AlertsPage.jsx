import { useEffect, useState } from 'react';
import { getLowStockAlerts } from '../api/services';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await getLowStockAlerts();
      setAlerts(data);
    } catch { toast.error('Failed to load alerts'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Low Stock Alerts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {alerts.length} items need restocking
          </p>
        </div>
        <button className="btn-secondary" onClick={fetch} disabled={loading} style={{ gap: '6px' }}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : alerts.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <AlertTriangle size={48} style={{ margin: '0 auto 16px', color: 'var(--accent-green)', opacity: 0.5 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>All Good! 🎉</h3>
          <p style={{ color: 'var(--text-muted)' }}>No items are below their low stock threshold.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>In Stock</th>
                <th>Threshold</th>
                <th>Status</th>
                <th>Supplier</th>
                <th>Selling Price</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(p => (
                <tr key={p._id} className={p.stock_quantity === 0 ? 'low-stock-pulse' : ''}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {p.sub_category && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.sub_category}</div>}
                  </td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-primary)' }}>{p.sku_code}</span></td>
                  <td><span className="badge badge-purple">{p.category}</span></td>
                  <td>
                    <span className={`badge ${p.stock_quantity === 0 ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: '13px', padding: '4px 12px' }}>
                      {p.stock_quantity}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>≤ {p.low_stock_threshold}</td>
                  <td>
                    <span className={`badge ${p.stock_quantity === 0 ? 'badge-red' : 'badge-yellow'}`}>
                      {p.stock_quantity === 0 ? '🔴 Out of Stock' : '🟡 Low Stock'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{p.supplier || '—'}</td>
                  <td style={{ fontWeight: 700 }}>Rs. {p.selling_price.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
