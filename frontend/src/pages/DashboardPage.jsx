import { useEffect, useState, useCallback } from 'react';
import { getAnalytics, getLowStockAlerts } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, DollarSign, ShoppingBag, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useIsMobile from '../hooks/useIsMobile';

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [analyticsRes, alertsRes] = await Promise.all([
        getAnalytics('daily'),
        getLowStockAlerts(),
      ]);
      setSummary(analyticsRes.data.summary);
      setLowStock(alertsRes.data || []);
    } catch (err) {
      if (err.response?.status !== 401) {
        setError(true);
        toast.error('Could not load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (val) =>
    `Rs. ${(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const stats = [
    {
      label: "Today's Revenue", color: 'purple', icon: DollarSign,
      value: loading ? '—' : fmt(summary?.total_revenue),
      sub: `${summary?.total_transactions ?? 0} transactions today`,
      show: true 
    },
    {
      label: "Today's Profit", color: 'green', icon: TrendingUp,
      value: loading ? '—' : fmt(summary?.total_profit),
      sub: summary?.total_revenue ? `${((summary.total_profit / summary.total_revenue) * 100).toFixed(1)}% margin` : 'No sales yet',
      show: user?.role === 'admin' || user?.role === 'super_admin'
    },
    {
      label: 'Bills Generated', color: 'blue', icon: ShoppingBag,
      value: loading ? '—' : String(summary?.total_transactions ?? 0),
      sub: summary?.avg_transaction ? `Avg ${fmt(summary.avg_transaction)}` : 'today',
      show: true
    },
    {
      label: 'Low Stock Items', color: 'yellow', icon: AlertTriangle,
      value: loading ? '—' : String(lowStock.length),
      sub: lowStock.length > 0 ? 'Needs restocking!' : 'All levels healthy',
      onClick: () => navigate('/alerts'),
      show: true
    },
  ].filter(s => s.show);

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Welcome, <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{user?.name}</span> ·{' '}
            <span style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>{user?.role}</span>
          </p>
        </div>
        <button onClick={fetchData} disabled={loading} className="btn-secondary" style={{ padding: '8px 14px', gap: '6px' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Top Stat Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${stats.length}, 1fr)`, gap: '12px', marginBottom: '20px' }}>
        {stats.map((s) => (
          <div key={s.label} className={`stat-card ${s.color}`} style={{ cursor: s.onClick ? 'pointer' : 'default' }} onClick={s.onClick}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>{s.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</p>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: s.color === 'purple' ? 'rgba(99,102,241,0.15)' : s.color === 'green' ? 'rgba(16,185,129,0.15)' : s.color === 'blue' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={19} color={s.color === 'purple' ? '#6366f1' : s.color === 'green' ? '#10b981' : s.color === 'blue' ? '#3b82f6' : '#f59e0b'} />
              </div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
        {/* Quick Actions */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Quick Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: '🛒 New Sale / POS', path: '/pos', color: '#6366f1', desc: 'Start a new billing session', show: true },
              { label: '📦 Add Product', path: '/inventory', color: '#10b981', desc: 'Add spare part to inventory', show: true },
              { label: '📊 View Analytics', path: '/analytics', color: '#3b82f6', desc: 'Detailed sales reports', show: true },
              { label: '👥 Manage Staff', path: '/users', color: '#8b5cf6', desc: 'Approve or manage users', show: user?.role === 'admin' || user?.role === 'super_admin' },
            ].filter(a => a.show).map((a) => (
              <button key={a.path} onClick={() => navigate(a.path)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.desc}</div>
                </div>
                <ArrowRight size={16} color={a.color} />
              </button>
            ))}
          </div>
        </div>

        {/* --- ✅ FIXED LOW STOCK SECTION --- */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Low Stock Alerts</h2>
            <button onClick={() => navigate('/alerts')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
              View All →
            </button>
          </div>

          {loading ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: '48px', background: 'var(--bg-secondary)', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />)}
             </div>
          ) : lowStock.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '13px' }}>✅ All stock levels healthy!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lowStock.slice(0, 5).map(p => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SKU: {p.sku_code}</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>{p.stock_quantity} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}