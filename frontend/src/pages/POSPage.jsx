import { useState, useEffect, useCallback } from 'react';
import { getProducts, createSale } from '../api/services';
import { useAuth } from '../context/AuthContext'; // 👈 Auth context eka gaththa
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  CreditCard, Banknote, Smartphone, X, CheckCircle, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['All', 'Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road'];

export default function POSPage() {
  const { user } = useAuth(); // 👈 Log wela inna user wa gaththa
  const isAdmin = user?.role === 'admin'; // 👈 Admin check eka boolean ekak widiyata
  const navigate = useNavigate();

  const [products, setProducts]           = useState([]);
  const [search, setSearch]               = useState('');
  const [category, setCategory]           = useState('All');
  const [cart, setCart]                   = useState([]);
  const [billDiscount, setBillDiscount]   = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleSource, setSaleSource]       = useState('shop');
  const [processing, setProcessing]       = useState(false);
  const [successSale, setSuccessSale]     = useState(null); 
  const [loading, setLoading]             = useState(false);

  // ── Fetch products ──────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProducts({ search, category, limit: 100 });
      setProducts(data.products || []);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (product) => {
    if (product.stock_quantity <= 0) { toast.error('Out of stock!'); return; }
    setCart(prev => {
      const existing = prev.find(i => i._id === product._id);
      if (existing) {
        if (existing.qty >= product.stock_quantity) { toast.error('Insufficient stock!'); return prev; }
        return prev.map(i => i._id === product._id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1, itemDiscount: 0 }];
    });
    setSearch('');
  };

  const updateQty = (id, delta) =>
    setCart(prev => prev.map(i =>
      i._id === id ? { ...i, qty: Math.max(1, Math.min(i.stock_quantity, i.qty + delta)) } : i
    ));

  const updateDiscount = (id, val) =>
    setCart(prev => prev.map(i =>
      i._id === id ? { ...i, itemDiscount: Math.max(0, Number(val)) } : i
    ));

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i._id !== id));

  const clearAll = () => {
    setCart([]);
    setBillDiscount(0);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('Cash');
    setSaleSource('shop');
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const subtotal     = cart.reduce((s, i) => s + i.selling_price * i.qty, 0);
  const itemDiscount = cart.reduce((s, i) => s + i.itemDiscount * i.qty, 0);
  const totalAmount  = subtotal - itemDiscount - Number(billDiscount);
  const totalCost    = cart.reduce((s, i) => s + i.buying_price  * i.qty, 0);
  const totalProfit  = totalAmount - totalCost;

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart is empty!'); return; }
    if (totalAmount < 0)   { toast.error('Discount exceeds total!'); return; }

    setProcessing(true);
    try {
      const payload = {
        items: cart.map(i => ({
          product_id: i._id,
          quantity:   i.qty,
          discount:   i.itemDiscount,
        })),
        total_discount: Number(billDiscount),
        payment_method: paymentMethod,
        sale_source:    saleSource,
        customer_name:  customerName  || 'Walk-in Customer',
        customer_phone: customerPhone || '',
      };

      const { data } = await createSale(payload);
      setSuccessSale(data);
      clearAll();
      toast.success('Sale saved! ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed — try again');
    } finally {
      setProcessing(false);
    }
  };

  const fmtRs = (v) =>
    `Rs. ${Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div
      className="animate-fade"
      style={{ display: 'grid', gridTemplateColumns: '1fr 390px', gap: '20px', height: 'calc(100vh - 56px)', overflow: 'hidden' }}
    >
      {/* LEFT: Products */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
        <div>
          <h1 className="page-title">POS / Billing</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Click an item to add it to the cart
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input-field"
            placeholder="Search spare parts by name or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', border: '1px solid', transition: 'all 0.2s',
              borderColor: category === cat ? 'var(--accent-primary)' : 'var(--border-light)',
              background:   category === cat ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
              color:        category === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}>{cat}</button>
          ))}
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', paddingRight: '4px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '10px', alignContent: 'start',
        }}>
          {loading ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading products…</p>
          ) : products.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No products found</p>
          ) : products.map(p => {
            const inCart = cart.find(i => i._id === p._id);
            const outOfStock = p.stock_quantity <= 0;
            return (
              <button
                key={p._id}
                onClick={() => addToCart(p)}
                disabled={outOfStock}
                style={{
                  background:   inCart ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                  border:       `1px solid ${inCart ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                  borderRadius: '12px', padding: '12px', cursor: outOfStock ? 'not-allowed' : 'pointer',
                  textAlign: 'left', transition: 'all 0.2s ease', opacity: outOfStock ? 0.45 : 1,
                }}
              >
                <div style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '4px', fontFamily: 'monospace' }}>{p.sku_code}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.3 }}>{p.name}</div>
                <span className="badge badge-purple" style={{ fontSize: '9px', marginBottom: '6px', padding: '2px 6px' }}>{p.category}</span>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '2px' }}>{fmtRs(p.selling_price)}</div>
                <div style={{ fontSize: '10px', color: outOfStock ? '#ef4444' : p.stock_quantity <= p.low_stock_threshold ? '#f59e0b' : 'var(--text-muted)' }}>
                  {outOfStock ? '❌ Out of stock' : `${p.stock_quantity} in stock`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '16px', overflow: 'hidden', height: '100%' }}>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingCart size={18} color="var(--accent-primary)" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Cart</span>
            {cart.length > 0 && <span className="badge badge-purple" style={{ fontSize: '11px' }}>{cart.length}</span>}
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <button onClick={() => setSaleSource('shop')} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', background: saleSource === 'shop' ? '#10b981' : 'transparent', color: saleSource === 'shop' ? 'white' : 'var(--text-muted)' }}>Shop</button>
            <button onClick={() => setSaleSource('online')} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', background: saleSource === 'online' ? '#3b82f6' : 'transparent', color: saleSource === 'online' ? 'white' : 'var(--text-muted)' }}>Online</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <ShoppingCart size={40} style={{ margin: '0 auto 12px', opacity: 0.18 }} />
              <p style={{ fontSize: '14px' }}>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item._id} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '10px', marginBottom: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{item.name}</div>
                  </div>
                  <button onClick={() => removeFromCart(item._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={() => updateQty(item._id, -1)} className="btn-secondary" style={{ padding: '2px 8px' }}>-</button>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{item.qty}</span>
                    <button onClick={() => updateQty(item._id, 1)} className="btn-secondary" style={{ padding: '2px 8px' }}>+</button>
                  </div>
                  <input
                      type="number" min="0" value={item.itemDiscount}
                      onChange={e => updateDiscount(item._id, e.target.value)}
                      style={{ width: '55px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '2px 5px', fontSize: '11px' }}
                  />
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>{fmtRs((item.selling_price - item.itemDiscount) * item.qty)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '14px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <input className="input-field" placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ fontSize: '12px' }} />
            <input className="input-field" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={{ fontSize: '12px', width: '110px' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bill Discount</span>
            <input type="number" value={billDiscount} onChange={e => setBillDiscount(e.target.value)} className="input-field" style={{ fontSize: '12px' }} />
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {['Cash', 'Card', 'Online'].map(label => (
              <button key={label} onClick={() => setPaymentMethod(label)} style={{
                flex: 1, padding: '7px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                background: paymentMethod === label ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                color: paymentMethod === label ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border-light)'
              }}>{label}</button>
            ))}
          </div>

          <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subtotal</span>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>{fmtRs(subtotal)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '7px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-primary)' }}>{fmtRs(totalAmount)}</span>
            </div>
            
            {/* 🔐 1. Est. Profit card for Admins only */}
            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>Est. Profit</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#10b981' }}>{fmtRs(totalProfit)}</span>
              </div>
            )}
          </div>

          <button className="btn-success" onClick={handleCheckout} disabled={processing || cart.length === 0} style={{ width: '100%', padding: '13px' }}>
            {processing ? 'Processing…' : `Complete Sale · ${fmtRs(totalAmount)}`}
          </button>
        </div>
      </div>

      {/* SUCCESS MODAL */}
      {successSale && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Sale Saved! ✅</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', margin: '20px 0', textAlign: 'left' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice No</div>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{successSale.invoice_number}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discount</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>
                  {fmtRs(
                    (successSale.total_discount || 0) + 
                    (successSale.items?.reduce((acc, i) => acc + ((i.discount || 0) * i.quantity), 0) || 0)
                  )}
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '10px' }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Amount</div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{fmtRs(successSale.total_amount)}</div>
              </div>
              
              {/* 🔐 2. Profit in modal for Admins only */}
              {isAdmin && (
                <div style={{ background: 'rgba(16,185,129,0.1)', padding: '12px', borderRadius: '10px', gridColumn: '1/-1' }}>
                  <div style={{ fontSize: '10px', color: '#10b981' }}>Net Profit</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>{fmtRs(successSale.total_profit)}</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" onClick={() => setSuccessSale(null)} style={{ flex: 1 }}>New Sale</button>
              <button className="btn-secondary" onClick={() => navigate('/sales')}>History</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}