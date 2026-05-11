import { useEffect, useState, useCallback } from 'react';
import { getSales, deleteSale } from '../api/services';
import { useAuth } from '../context/AuthContext'; // 👈 Auth context eka gaththa
import { Search, Eye, ChevronLeft, ChevronRight, X, TrendingUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SalesHistoryPage() {
  const { user } = useAuth(); // User role eka check karanna
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'; // Boolean flag ekak hadagaththa lesiyata

  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewSale, setViewSale] = useState(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSales({ page, limit: 15, from, to, payment_method: paymentFilter, sale_source: sourceFilter });
      setSales(data.sales);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  }, [page, from, to, paymentFilter, sourceFilter]);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => { setPage(1); }, [from, to, paymentFilter, sourceFilter]);

  const fmt = (v) => `Rs. ${Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleDeleteSale = async (id) => {
    if (!window.confirm('Delete this sale? This will also return the stock back to the inventory.')) return;
    try {
      await deleteSale(id);
      toast.success('Sale deleted and stock restored');
      fetchSales();
    } catch {
      toast.error('Failed to delete sale');
    }
  };

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Sales History {!isAdmin && <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>(Standard Access)</span>}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{total} total transactions recorded</p>
        </div>
      </div>

      {/* Filters logic remains same */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From</span>
          <input type="date" className="input-field" value={from} onChange={e => setFrom(e.target.value)} style={{ width: '150px', padding: '8px 12px', fontSize: '13px' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To</span>
          <input type="date" className="input-field" value={to} onChange={e => setTo(e.target.value)} style={{ width: '150px', padding: '8px 12px', fontSize: '13px' }} />
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
          {[
            { value: '', label: 'All', color: '#6366f1' },
            { value: 'shop', label: 'Shop', color: '#8b5cf6' },
            { value: 'online', label: 'Web', color: '#3b82f6' },
            { value: 'whatsapp', label: 'WhatsApp', color: '#22c55e' },
          ].map(s => (
            <button key={s.value} onClick={() => setSourceFilter(s.value)} style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: sourceFilter === s.value ? s.color : 'transparent',
              color: sourceFilter === s.value ? 'white' : 'var(--text-muted)',
            }}>{s.label}</button>
          ))}
        </div>
        <select className="select-field" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ width: '140px', padding: '8px 12px', fontSize: '13px' }}>
          <option value="">All Payments</option>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="Online">Online</option>
        </select>
        {(from || to || paymentFilter || sourceFilter) && (
          <button className="btn-secondary" onClick={() => { setFrom(''); setTo(''); setPaymentFilter(''); setSourceFilter(''); }} style={{ padding: '8px 12px', fontSize: '13px' }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th style={{ textAlign: 'center' }}>Source</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Total</th>
                {/* 🔐 Admin Only Header */}
                {isAdmin && <th>Profit</th>} 
                <th>Payment</th>
                <th>Cashier</th>
                <th style={{ textAlign: 'center' }}>View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 11 : 10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={isAdmin ? 11 : 10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No sales found</td></tr>
              ) : sales.map(s => (
                <tr key={s._id}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 700 }}>{s.invoice_number}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(s.createdAt).toLocaleDateString('en-LK')}<br />
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(s.createdAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td style={{ fontSize: '13px' }}>{s.customer_name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${s.sale_source === 'whatsapp' ? 'badge-green' : s.sale_source === 'online' ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: '10px' }}>
                      {s.sale_source === 'whatsapp' ? 'WhatsApp' : s.sale_source === 'online' ? 'Online' : 'Shop'}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', textAlign: 'center' }}>{s.items?.length}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(s.subtotal)}</td>
                  <td style={{ fontWeight: 600, color: '#ef4444', fontSize: '13px' }}>
                    {((s.total_discount || 0) + (s.items?.reduce((acc, i) => acc + ((i.discount || 0) * i.quantity), 0) || 0)) > 0 
                      ? `- ${fmt((s.total_discount || 0) + (s.items?.reduce((acc, i) => acc + ((i.discount || 0) * i.quantity), 0) || 0))}` 
                      : '-'}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{fmt(s.total_amount)}</td>
                  
                  {/* 🔐 Admin Only Cell */}
                  {isAdmin && (
                    <td>
                      <span style={{ color: s.total_profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '13px' }}>
                        {fmt(s.total_profit)}
                      </span>
                    </td>
                  )}

                  <td>
                    <span className={`badge ${s.payment_method === 'Cash' ? 'badge-green' : s.payment_method === 'Card' ? 'badge-blue' : 'badge-purple'}`}>
                      {s.payment_method}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.cashier_name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button onClick={() => setViewSale(s)} style={{ padding: '6px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', cursor: 'pointer', color: '#6366f1' }}>
                        <Eye size={14} />
                      </button>
                      {user?.role === 'super_admin' && (
                        <button onClick={() => handleDeleteSale(s._id)} style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', cursor: 'pointer', color: '#ef4444' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination logic remains same */}
      </div>

      {/* Sale Detail Modal */}
      {viewSale && (
        <div className="modal-overlay" onClick={() => setViewSale(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Invoice Detail</h2>
                <p style={{ fontSize: '13px', color: 'var(--accent-primary)', fontFamily: 'monospace', marginTop: '2px' }}>{viewSale.invoice_number}</p>
              </div>
              <button onClick={() => setViewSale(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px' }}>
              {[
                ['Customer', viewSale.customer_name],
                ['Date', new Date(viewSale.createdAt).toLocaleString('en-LK')],
                ['Source', viewSale.sale_source === 'whatsapp' ? 'WhatsApp' : viewSale.sale_source === 'online' ? 'Online' : 'Shop'],
                ['Payment', viewSale.payment_method],
                ['Cashier', viewSale.cashier_name],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '16px', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
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
                  {viewSale.items?.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.product_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.sku_code}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', fontSize: '12px' }}>{fmt(item.selling_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13px' }}>{fmt(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{fmt(viewSale.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Discount</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>
                  - {fmt((viewSale.total_discount || 0) + (viewSale.items?.reduce((acc, i) => acc + ((i.discount || 0) * i.quantity), 0) || 0))}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>PRODUCT TOTAL</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)' }}>{fmt(viewSale.total_amount)}</span>
              </div>

              {/* Delivery and Logistics Block */}
              {(viewSale.shipping_cost_charged > 0 || viewSale.actual_shipping_cost > 0 || viewSale.paid_amount > 0 || viewSale.cod_amount > 0) && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-light)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Logistics & COD</div>
                  
                  {(viewSale.shipping_cost_charged > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Delivery Fee Charged</span>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{fmt(viewSale.shipping_cost_charged)}</span>
                    </div>
                  )}
                  {isAdmin && viewSale.actual_shipping_cost !== undefined && viewSale.actual_shipping_cost > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#ef4444' }}>Courier Cost (Actual)</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>{fmt(viewSale.actual_shipping_cost)}</span>
                    </div>
                  )}
                  {(viewSale.paid_amount > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Paid Amount (Advance)</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>{fmt(viewSale.paid_amount)}</span>
                    </div>
                  )}
                  {(viewSale.cod_amount > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', background: 'rgba(245,158,11,0.08)', padding: '6px 8px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>COD TO COLLECT</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>{fmt(viewSale.cod_amount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* KOKO Charge Block */}
              {viewSale.koko_charge > 0 && (
                <div style={{ marginTop: '10px', background: 'rgba(168,85,247,0.08)', padding: '8px 10px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 700 }}>KOKO Charge ({viewSale.koko_percentage || 10}%)</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7' }}>+{fmt(viewSale.koko_charge)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#a855f7' }}>KOKO Final Total</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#a855f7' }}>{fmt(viewSale.total_amount + viewSale.koko_charge + (viewSale.shipping_cost_charged || 0))}</span>
                  </div>
                </div>
              )}

              {/* 🔐 Admin Only Profit in Modal */}
              {isAdmin && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed var(--border-light)', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', padding: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={14} /> Total Profit
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>{fmt(viewSale.total_profit)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}