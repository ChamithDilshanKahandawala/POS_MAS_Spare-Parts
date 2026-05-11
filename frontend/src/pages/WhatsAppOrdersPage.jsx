import { useEffect, useState, useCallback, useMemo } from 'react';
import { getSales } from '../api/services';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Truck, Package, CheckCircle, Clock, Phone, X, Navigation,
  Search, RefreshCw, ShoppingBag, DollarSign, XCircle,
  Calendar, Filter, ChevronDown, Eye, MapPin, User, CreditCard, RotateCcw,
} from 'lucide-react';
import api from '../api/axios';
import useIsMobile from '../hooks/useIsMobile';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUSES = [
  { value: 'All',        label: 'All Orders',  color: 'var(--text-muted)',   bg: 'var(--bg-secondary)',               icon: ShoppingBag },
  { value: 'Pending',    label: 'Pending',     color: '#f59e0b',            bg: 'rgba(245,158,11,0.12)',             icon: Clock },
  { value: 'Processing', label: 'Processing',  color: '#3b82f6',            bg: 'rgba(59,130,246,0.12)',             icon: Package },
  { value: 'Shipped',    label: 'Shipped',     color: '#8b5cf6',            bg: 'rgba(139,92,246,0.12)',             icon: Truck },
  { value: 'Delivered',  label: 'Delivered',    color: '#10b981',            bg: 'rgba(16,185,129,0.12)',             icon: CheckCircle },
  { value: 'Cancelled',  label: 'Cancelled',   color: '#ef4444',            bg: 'rgba(239,68,68,0.12)',              icon: XCircle },
  { value: 'Returned',   label: 'Returned',    color: '#db2777',            bg: 'rgba(219,39,119,0.12)',             icon: RotateCcw },
];

const PERIOD_OPTIONS = [
  { value: 'all',     label: 'All Time' },
  { value: 'today',   label: 'Today' },
  { value: 'week',    label: 'This Week' },
  { value: 'month',   label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
];

function getDateRange(period) {
  const now = new Date();
  let from = null;
  if (period === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    from = new Date(now);
    from.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'quarter') {
    from = new Date(now);
    from.setMonth(now.getMonth() - 3);
  }
  return from ? from.toISOString().split('T')[0] : undefined;
}

export default function WhatsAppOrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isMobile = useIsMobile();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('All');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [trackingModal, setTrackingModal] = useState({ isOpen: false, orderId: null });
  const [trackingInput, setTrackingInput] = useState('');
  const [detailModal, setDetailModal] = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchOnlineOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { sale_source: 'whatsapp', limit: 200 };
      const from = getDateRange(periodFilter);
      if (from) params.from = from;
      // Fetch ALL orders for the given date period so that the status tab counts work correctly

      const { data } = await getSales(params);
      setOrders(data.sales || []);
    } catch {
      toast.error('Failed to load WhatsApp orders');
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => {
    fetchOnlineOrders();
    const handleNewOrder = () => fetchOnlineOrders();
    window.addEventListener('whatsapp_order_received', handleNewOrder);
    return () => window.removeEventListener('whatsapp_order_received', handleNewOrder);
  }, [fetchOnlineOrders]);

  // ── Client-side search and status filter ──────────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'All') {
      result = result.filter(o => (o.order_status || 'Pending') === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.invoice_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q)
      );
    }
    return result;
  }, [orders, statusFilter, searchQuery]);

  // ── Status counts for badges ──────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = { All: orders.length };
    for (const s of STATUSES) {
      if (s.value !== 'All') counts[s.value] = 0;
    }
    orders.forEach(o => {
      const st = o.order_status || 'Pending';
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
  }, [orders]);

  // ── Status update ─────────────────────────────────────────────────────────
  const updateStatus = async (id, newStatus, trackingNum = undefined) => {
    try {
      await api.put(`/sales/${id}/status`, { order_status: newStatus, tracking_number: trackingNum });
      toast.success(`Order → ${newStatus}`);
      fetchOnlineOrders();
      if (trackingModal.isOpen) setTrackingModal({ isOpen: false, orderId: null });
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleStatusChange = (id, newStatus) => {
    if (newStatus === 'Shipped') {
      setTrackingInput('');
      setTrackingModal({ isOpen: true, orderId: id });
    } else {
      updateStatus(id, newStatus);
    }
  };

  const submitTracking = () => {
    if (!trackingInput.trim()) { toast.error('Enter a tracking number'); return; }
    updateStatus(trackingModal.orderId, 'Shipped', trackingInput);
  };

  const getStatusConfig = (status) => STATUSES.find(s => s.value === status) || STATUSES[1];

  const fmtRs = (v) => `Rs. ${Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTime = (d) => new Date(d).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const pendingCount = statusCounts['Pending'] || 0;
  const shippedCount = statusCounts['Shipped'] || 0;
  const deliveredCount = statusCounts['Delivered'] || 0;

  return (
    <>
      <div className="animate-fade">
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className="page-title">WhatsApp Orders</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              {orders.length} WhatsApp orders · Manage order lifecycle
            </p>
          </div>
          <button onClick={fetchOnlineOrders} disabled={loading} className="btn-secondary" style={{ padding: '8px 14px', gap: '6px' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* ── Summary Mini-Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Total Revenue', value: fmtRs(totalRevenue), color: 'purple', icon: DollarSign },
            { label: 'Pending', value: pendingCount, color: 'yellow', icon: Clock },
            { label: 'Shipped', value: shippedCount, color: 'purple', icon: Truck },
            { label: 'Delivered', value: deliveredCount, color: 'green', icon: CheckCircle },
          ].map(s => (
            <div key={s.label} className={`stat-card ${s.color}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '5px' }}>{s.label}</p>
                  <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{loading ? '—' : s.value}</p>
                </div>
                <s.icon size={16} color={s.color === 'purple' ? '#6366f1' : s.color === 'green' ? '#10b981' : '#f59e0b'} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 1 260px', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input-field"
              placeholder="Search invoice, name, phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '13px' }}
            />
          </div>

          {/* Period filter */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
            {PERIOD_OPTIONS.map(p => (
              <button key={p.value} onClick={() => setPeriodFilter(p.value)} style={{
                padding: isMobile ? '5px 8px' : '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', transition: 'all 0.2s',
                background: periodFilter === p.value ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                color: periodFilter === p.value ? 'white' : 'var(--text-muted)',
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* ── Status Tab Bar ── */}
        <div style={{
          display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto',
          paddingBottom: '4px', WebkitOverflowScrolling: 'touch',
        }}>
          {STATUSES.map(s => {
            const isActive = statusFilter === s.value;
            const count = statusCounts[s.value] || 0;
            const Icon = s.icon;
            return (
              <button key={s.value} onClick={() => setStatusFilter(s.value)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', border: '1px solid', whiteSpace: 'nowrap', transition: 'all 0.2s',
                flexShrink: 0,
                borderColor: isActive ? s.color : 'var(--border-light)',
                background: isActive ? s.bg : 'var(--bg-card)',
                color: isActive ? s.color : 'var(--text-muted)',
              }}>
                <Icon size={14} />
                {s.label}
                <span style={{
                  background: isActive ? s.color : 'var(--bg-secondary)',
                  color: isActive ? 'white' : 'var(--text-muted)',
                  borderRadius: '999px', padding: '1px 7px', fontSize: '10px', fontWeight: 800,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Orders Grid ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: '280px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <ShoppingBag size={40} style={{ margin: '0 auto 12px', opacity: 0.15 }} />
            <p style={{ fontSize: '14px', fontWeight: 600 }}>No orders found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              {statusFilter !== 'All' ? `No "${statusFilter}" orders in this period` : 'No WhatsApp orders yet'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {filteredOrders.map(order => {
              const statusConf = getStatusConfig(order.order_status || 'Pending');
              const StatusIcon = statusConf.icon;
              return (
                <div key={order._id} className="glass-card" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Card Header */}
                  <div style={{
                    padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid var(--border)',
                    background: statusConf.bg,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusIcon size={16} color={statusConf.color} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: statusConf.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {order.order_status || 'Pending'}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                      {order.invoice_number}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '16px 18px', flex: 1 }}>
                    {/* Customer info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={14} color="var(--text-muted)" />
                          {order.customer_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={11} /> {order.customer_phone || 'N/A'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtDate(order.createdAt)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmtTime(order.createdAt)}</div>
                      </div>
                    </div>

                    {/* Address */}
                    {order.shipping_address && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                        <MapPin size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>{order.shipping_address}</span>
                      </div>
                    )}

                    {/* Items preview */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '10px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Items ({order.items?.length})
                      </div>
                      {order.items?.slice(0, 3).map(i => (
                        <div key={i._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                            {i.quantity}× {i.product_name}
                          </span>
                          <span style={{ fontWeight: 600, flexShrink: 0 }}>Rs. {i.line_total?.toLocaleString()}</span>
                        </div>
                      ))}
                      {order.items?.length > 3 && (
                        <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, marginTop: '4px' }}>
                          +{order.items.length - 3} more items
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', paddingTop: '6px', marginTop: '6px', fontWeight: 700, fontSize: '13px' }}>
                        <span>Total</span>
                        <span style={{ color: 'var(--accent-primary)' }}>{fmtRs(order.total_amount)}</span>
                      </div>
                    </div>

                    {/* Payment + Tracking */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
                      <span className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                        <CreditCard size={10} /> {order.payment_method || 'N/A'}
                      </span>
                      {order.tracking_number && (
                        <span className="badge badge-yellow" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                          <Navigation size={10} /> {order.tracking_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer — Actions */}
                  <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      className="select-field"
                      value={order.order_status || 'Pending'}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', fontSize: '12px', borderRadius: '8px' }}
                    >
                      <option value="Pending">⏳ Pending</option>
                      <option value="Processing">📦 Processing</option>
                      <option value="Shipped">🚚 Shipped</option>
                      <option value="Delivered">✅ Delivered</option>
                      <option value="Cancelled">❌ Cancelled</option>
                      <option value="Returned">🔄 Returned</option>
                    </select>
                    <button
                      onClick={() => setDetailModal(order)}
                      style={{
                        padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)',
                        background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--accent-primary)',
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600,
                      }}
                    >
                      <Eye size={14} /> View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tracking Number Modal ── */}
      {trackingModal.isOpen && (
        <div className="modal-overlay" onClick={() => setTrackingModal({ isOpen: false, orderId: null })}>
          <div className="modal-box glass-card animate-fade" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} color="var(--accent-primary)" /> Add Tracking Number
              </h2>
              <button onClick={() => setTrackingModal({ isOpen: false, orderId: null })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Courier Tracking ID / URL
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. DPX-123456789"
                style={{ width: '100%' }}
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                autoFocus
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                This tracking number will be visible to the customer on their order page.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setTrackingModal({ isOpen: false, orderId: null })} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={submitTracking} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} /> Ship Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order Detail Modal ── */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Order Detail</h2>
                <p style={{ fontSize: '13px', color: 'var(--accent-primary)', fontFamily: 'monospace', marginTop: '2px' }}>{detailModal.invoice_number}</p>
              </div>
              <button onClick={() => setDetailModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Status Badge large */}
            {(() => {
              const sc = getStatusConfig(detailModal.order_status || 'Pending');
              const SIcon = sc.icon;
              return (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', background: sc.bg, color: sc.color, fontWeight: 700, fontSize: '13px', marginBottom: '16px' }}>
                  <SIcon size={16} />
                  {detailModal.order_status || 'Pending'}
                </div>
              );
            })()}

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '8px', marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px' }}>
              {[
                ['Customer', detailModal.customer_name],
                ['Phone', detailModal.customer_phone || 'N/A'],
                ['Date', fmtDate(detailModal.createdAt) + ' ' + fmtTime(detailModal.createdAt)],
                ['Payment', detailModal.payment_method],
                ['Tracking', detailModal.tracking_number || '—'],
                ['Address', detailModal.shipping_address || 'N/A'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Items Table */}
            <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '16px', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.items?.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '12px' }}>{item.product_name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.sku_code}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', fontSize: '12px' }}>{fmtRs(item.selling_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12px' }}>{fmtRs(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Subtotal</span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{fmtRs(detailModal.subtotal)}</span>
              </div>
              {(detailModal.total_discount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Discount</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>-{fmtRs(detailModal.total_discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>PRODUCT TOTAL</span>
                <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-primary)' }}>{fmtRs(detailModal.total_amount)}</span>
              </div>

              {/* Delivery and Logistics Block */}
              {(detailModal.shipping_cost_charged > 0 || detailModal.actual_shipping_cost > 0 || detailModal.paid_amount > 0 || detailModal.cod_amount > 0) && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-light)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Logistics & COD</div>
                  
                  {(detailModal.shipping_cost_charged > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Delivery Fee Charged</span>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{fmtRs(detailModal.shipping_cost_charged)}</span>
                    </div>
                  )}
                  {isAdmin && detailModal.actual_shipping_cost !== undefined && detailModal.actual_shipping_cost > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#ef4444' }}>Courier Cost (Actual)</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>{fmtRs(detailModal.actual_shipping_cost)}</span>
                    </div>
                  )}
                  {(detailModal.paid_amount > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Paid Amount (Advance)</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>{fmtRs(detailModal.paid_amount)}</span>
                    </div>
                  )}
                  {(detailModal.cod_amount > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', background: 'rgba(245,158,11,0.08)', padding: '6px 8px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>COD TO COLLECT</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>{fmtRs(detailModal.cod_amount)}</span>
                    </div>
                  )}
                </div>
              )}
              {/* KOKO Charge Block */}
              {detailModal.koko_charge > 0 && (
                <div style={{ marginTop: '10px', background: 'rgba(168,85,247,0.08)', padding: '8px 10px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 700 }}>KOKO Charge ({detailModal.koko_percentage || 10}%)</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7' }}>+{fmtRs(detailModal.koko_charge)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#a855f7' }}>KOKO Final Total</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#a855f7' }}>{fmtRs(detailModal.total_amount + detailModal.koko_charge + (detailModal.shipping_cost_charged || 0))}</span>
                  </div>
                </div>
              )}

              {isAdmin && detailModal.total_profit !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', background: 'rgba(16,185,129,0.08)', padding: '8px 10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>Final Net Profit</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>{fmtRs(detailModal.total_profit)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </>
  );
}
