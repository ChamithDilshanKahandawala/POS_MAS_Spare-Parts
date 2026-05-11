import { useEffect, useState } from 'react';
import { getAnalytics } from '../api/services';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, DollarSign, ShoppingBag, Target, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import useIsMobile from '../hooks/useIsMobile';

const PERIODS = [
  { label: 'Today', value: 'daily' },
  { label: 'Week', value: 'weekly' },
  { label: 'Month', value: 'monthly' },
  { label: 'Year', value: 'yearly' },
  { label: 'All', value: 'alltime' },
];

const SOURCES = [
  { label: 'All Sales', value: 'all' },
  { label: 'Shop', value: 'shop' },
  { label: 'Online', value: 'online' },
  { label: 'WhatsApp', value: 'whatsapp' },
];

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '10px 14px' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ fontSize: '12px', fontWeight: 600, color: p.color }}>
            {p.name}: {p.name === 'Transactions' ? p.value : `Rs. ${Number(p.value).toLocaleString()}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isMobile = useIsMobile();

  const [period, setPeriod] = useState('monthly');
  const [saleSource, setSaleSource] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getAnalytics(period, saleSource);
        setData(res.data);
      } catch {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, saleSource]);

  const fmt = (v) => `Rs. ${Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtShort = (v) => {
    if (v >= 1000000) return `Rs. ${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `Rs. ${(v / 1000).toFixed(1)}K`;
    return `Rs. ${v}`;
  };

  const summary = data?.summary || {};
  const profitMargin = summary.total_revenue
    ? ((summary.total_profit / summary.total_revenue) * 100).toFixed(1)
    : 0;
  const avgTransaction = summary.avg_transaction || 0;

  const stats = [
    { label: 'Total Revenue', value: fmt(summary.total_revenue), short: fmtShort(summary.total_revenue || 0), color: 'purple', icon: DollarSign, sub: 'Gross sales', show: true },
    { label: 'Net Profit', value: fmt(summary.total_profit), short: fmtShort(summary.total_profit || 0), color: 'green', icon: TrendingUp, sub: `${profitMargin}% margin`, show: isAdmin },
    { label: 'Total Cost', value: fmt(summary.total_cost), short: fmtShort(summary.total_cost || 0), color: 'blue', icon: Target, sub: 'Cost of goods', show: isAdmin },
    { label: 'Transactions', value: String(summary.total_transactions ?? 0), short: String(summary.total_transactions ?? 0), color: 'yellow', icon: ShoppingBag, sub: `Avg ${fmtShort(avgTransaction)}`, show: true },
  ].filter(s => s.show);

  const chartData = data?.chartData || [];
  const chartLabel = data?.groupLabel || 'Date';

  const statCols = isMobile ? '1fr 1fr' : `repeat(${stats.length}, 1fr)`;

  return (
    <div className="animate-fade" style={{ paddingBottom: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 className="page-title">Analytics</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Sales performance & profit insights</p>
      </div>

      {/* Filters — stacked on mobile */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {/* Source */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
          {SOURCES.map(s => (
            <button key={s.value} onClick={() => setSaleSource(s.value)}
              style={{
                padding: isMobile ? '6px 10px' : '7px 14px',
                borderRadius: '8px', fontSize: isMobile ? '11px' : '12px', fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
                background: saleSource === s.value ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: saleSource === s.value ? 'white' : 'var(--text-muted)',
              }}>{s.label}</button>
          ))}
        </div>

        {/* Period */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              style={{
                padding: isMobile ? '6px 10px' : '7px 14px',
                borderRadius: '8px', fontSize: isMobile ? '11px' : '12px', fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
                background: period === p.value ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                color: period === p.value ? 'white' : 'var(--text-muted)',
              }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Stat Cards — 2 cols on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: statCols, gap: '12px', marginBottom: '16px' }}>
        {stats.map(s => (
          <div key={s.label} className={`stat-card ${s.color}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: '6px' }}>{s.label}</p>
                <p style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{loading ? '—' : s.short}</p>
              </div>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                background: s.color === 'purple' ? 'rgba(99,102,241,0.15)' : s.color === 'green' ? 'rgba(16,185,129,0.15)' : s.color === 'blue' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.icon size={16} color={s.color === 'purple' ? '#6366f1' : s.color === 'green' ? '#10b981' : s.color === 'blue' ? '#3b82f6' : '#f59e0b'} />
              </div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{loading ? '...' : s.sub}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Area Chart + Pie — stack on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: '14px', marginBottom: '14px' }}>
        {/* Area Chart */}
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>
            Revenue vs Profit
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>by {chartLabel}</span>
          </h3>
          {loading ? (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading chart...</div>
          ) : chartData.length === 0 ? (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '8px' }}>
              <TrendingUp size={32} style={{ opacity: 0.2 }} />
              <span style={{ fontSize: '13px' }}>No sales data for this period</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="_id" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                {isAdmin && <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#profGrad)" strokeWidth={2} name="Profit" />}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>Sales by Category</h3>
          {loading ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : (data?.categoryData?.length === 0 ? (
            <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={data?.categoryData || []} dataKey="revenue" nameKey="_id" cx="50%" cy="50%" outerRadius={60} innerRadius={28}>
                    {(data?.categoryData || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                {(data?.categoryData || []).map((cat, i) => (
                  <div key={cat._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{cat._id || 'Unknown'}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Rs. {Number(cat.revenue).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ))}
        </div>
      </div>

      {/* Row 2: Payment Methods + Top Products — stack on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: '14px', marginBottom: '14px' }}>
        {/* Payment Methods */}
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>Payment Methods</h3>
          {loading ? <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</p>
            : (data?.paymentData?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No data</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(data?.paymentData || []).map((pm) => {
                  const total = (data?.paymentData || []).reduce((s, p) => s + p.revenue, 0);
                  const pct = total > 0 ? ((pm.revenue / total) * 100).toFixed(0) : 0;
                  const color = pm._id === 'Cash' ? '#10b981' : pm._id === 'Card' ? '#3b82f6' : '#8b5cf6';
                  return (
                    <div key={pm._id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{pm._id}</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color }}>{pct}%</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>{pm.count} bills</span>
                        </div>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                      </div>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Rs. {Number(pm.revenue).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>

        {/* Top Products */}
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
            <Award size={15} style={{ display: 'inline', marginRight: '6px', color: '#f59e0b' }} />
            Top 10 Products
          </h3>
          {loading ? <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</p>
            : (data?.topProducts?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No sales data</p>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: '220px' }}>
                {(data?.topProducts || []).map((p, i) => (
                  <div key={p._id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                      background: i === 0 ? 'rgba(245,158,11,0.2)' : i === 1 ? 'rgba(148,163,184,0.2)' : i === 2 ? 'rgba(180,115,70,0.2)' : 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 800,
                      color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b47346' : 'var(--text-muted)',
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p._id}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.quantity} units sold</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Rs. {Number(p.revenue).toLocaleString()}</div>
                      {isAdmin && <div style={{ fontSize: '10px', color: '#10b981' }}>+Rs. {Number(p.profit).toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* Row 3: Bar chart — always full width */}
      <div className="glass-card" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>
          Transaction Volume
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>
            Bills per {chartLabel?.toLowerCase()}
          </span>
        </h3>
        {loading ? (
          <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : chartData.length === 0 ? (
          <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="_id" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} allowDecimals={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="transactions" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
