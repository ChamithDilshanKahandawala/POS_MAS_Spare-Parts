import { useState, useEffect, useCallback } from 'react';
import { getProducts, createSale } from '../api/services';
import { useAuth } from '../context/AuthContext';
import {
  Search, Trash2, ShoppingCart,
  X, CheckCircle, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';

const CATEGORIES = ['All', 'Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road'];

export default function POSPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleSource, setSaleSource] = useState('shop');
  const [whatsappShippingCharged, setWhatsappShippingCharged] = useState(0);
  const [whatsappActualShipping, setWhatsappActualShipping] = useState(0);
  const [whatsappTracking, setWhatsappTracking] = useState('');
  const [whatsappPaidAmount, setWhatsappPaidAmount] = useState('');
  const [kokoPercentage, setKokoPercentage] = useState(10);
  const [processing, setProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState('products'); // 'products' | 'cart'

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProducts({ search, category, limit: 500 });
      setProducts(data.products || []);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

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
    if (isMobile) setMobileTab('cart'); // auto-switch to cart tab on mobile
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
    setWhatsappShippingCharged(0);
    setWhatsappActualShipping(0);
    setWhatsappTracking('');
    setWhatsappPaidAmount('');
    setKokoPercentage(10);
  };

  const subtotal = cart.reduce((s, i) => s + i.selling_price * i.qty, 0);
  const itemDiscount = cart.reduce((s, i) => s + i.itemDiscount * i.qty, 0);
  let totalAmount = subtotal - itemDiscount - Number(billDiscount);
  const totalCost = cart.reduce((s, i) => s + i.buying_price * i.qty, 0);
  let totalProfit = totalAmount - totalCost;

  if (saleSource === 'whatsapp') {
    totalProfit += Number(whatsappShippingCharged) - Number(whatsappActualShipping);
  }

  // KOKO charge calculation
  const kokoBaseAmount = saleSource === 'whatsapp' ? totalAmount + Number(whatsappShippingCharged) : totalAmount;
  const kokoCharge = paymentMethod === 'KOKO' ? Math.round(kokoBaseAmount * Number(kokoPercentage) / 100) : 0;
  const kokoFinalTotal = kokoBaseAmount + kokoCharge;

  const computedCodAmount = saleSource === 'whatsapp' ? Math.max(0, totalAmount + Number(whatsappShippingCharged) - Number(whatsappPaidAmount)) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart is empty!'); return; }
    if (totalAmount < 0) { toast.error('Discount exceeds total!'); return; }
    setProcessing(true);
    try {
      const payload = {
        items: cart.map(i => ({ product_id: i._id, quantity: i.qty, discount: i.itemDiscount })),
        total_discount: Number(billDiscount),
        payment_method: paymentMethod,
        sale_source: saleSource,
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone || '',
        shipping_cost_charged: saleSource === 'whatsapp' ? Number(whatsappShippingCharged) : 0,
        actual_shipping_cost: saleSource === 'whatsapp' ? Number(whatsappActualShipping) : 0,
        paid_amount: saleSource === 'whatsapp' ? Number(whatsappPaidAmount) : 0,
        cod_amount: saleSource === 'whatsapp' ? computedCodAmount : 0,
        tracking_number: saleSource === 'whatsapp' ? whatsappTracking : '',
        koko_charge: paymentMethod === 'KOKO' ? kokoCharge : 0,
        koko_percentage: paymentMethod === 'KOKO' ? Number(kokoPercentage) : 0,
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

  // ── Product grid panel ──────────────────────────────────────────────────────
  const ProductsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', flex: 1 }}>
      {!isMobile && (
        <div>
          <h1 className="page-title">POS / Billing</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Click an item to add it to cart</p>
        </div>
      )}

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
            padding: isMobile ? '5px 10px' : '6px 12px',
            borderRadius: '8px', fontSize: isMobile ? '11px' : '12px', fontWeight: 500,
            cursor: 'pointer', border: '1px solid', transition: 'all 0.2s',
            borderColor: category === cat ? 'var(--accent-primary)' : 'var(--border-light)',
            background: category === cat ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
            color: category === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
          }}>{cat}</button>
        ))}
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', paddingRight: '2px',
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(auto-fill,minmax(140px,1fr))' : 'repeat(auto-fill,minmax(160px,1fr))',
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
                background: inCart ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                border: `1px solid ${inCart ? 'var(--accent-primary)' : 'var(--border-light)'}`,
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
  );

  // ── Cart panel ──────────────────────────────────────────────────────────────
  const CartPanel = (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
      borderRadius: '16px', overflow: 'hidden',
      ...(isMobile ? { flex: 1 } : { width: '390px', flexShrink: 0, height: '100%' }),
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShoppingCart size={18} color="var(--accent-primary)" />
          <span style={{ fontSize: '15px', fontWeight: 700 }}>Cart</span>
          {cart.length > 0 && <span className="badge badge-purple" style={{ fontSize: '11px' }}>{cart.length}</span>}
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <button onClick={() => { setSaleSource('shop'); setPaymentMethod('Cash'); }} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', background: saleSource === 'shop' ? '#10b981' : 'transparent', color: saleSource === 'shop' ? 'white' : 'var(--text-muted)' }}>Shop</button>
          <button onClick={() => { setSaleSource('online'); setPaymentMethod('Online'); }} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', background: saleSource === 'online' ? '#3b82f6' : 'transparent', color: saleSource === 'online' ? 'white' : 'var(--text-muted)' }}>Web</button>
          <button onClick={() => { setSaleSource('whatsapp'); setPaymentMethod('COD'); }} style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', background: saleSource === 'whatsapp' ? '#22c55e' : 'transparent', color: saleSource === 'whatsapp' ? 'white' : 'var(--text-muted)' }}>WhatsApp</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <ShoppingCart size={36} style={{ margin: '0 auto 10px', opacity: 0.18 }} />
            <p style={{ fontSize: '13px' }}>Cart is empty</p>
            {isMobile && <button onClick={() => setMobileTab('products')} className="btn-primary" style={{ marginTop: '12px', padding: '8px 16px', fontSize: '12px' }}>Browse Products</button>}
          </div>
        ) : cart.map(item => (
          <div key={item._id} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '10px', marginBottom: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{item.name}</div>
              </div>
              <button onClick={() => removeFromCart(item._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => updateQty(item._id, -1)} className="btn-secondary" style={{ padding: '2px 8px' }}>-</button>
                <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                <button onClick={() => updateQty(item._id, 1)} className="btn-secondary" style={{ padding: '2px 8px' }}>+</button>
              </div>
              <input
                type="number" min="0" value={item.itemDiscount}
                onChange={e => updateDiscount(item._id, e.target.value)}
                placeholder="Disc."
                style={{ width: '55px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '2px 5px', fontSize: '11px', color: 'var(--text-primary)' }}
              />
              <div style={{ fontSize: '12px', fontWeight: 700 }}>{fmtRs((item.selling_price - item.itemDiscount) * item.qty)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px', borderTop: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input className="input-field" placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ fontSize: '12px' }} />
          <input className="input-field" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={{ fontSize: '12px', width: '100px' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Bill Disc.</span>
          <input type="number" value={billDiscount} onChange={e => setBillDiscount(e.target.value)} className="input-field" style={{ fontSize: '12px' }} />
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {(saleSource === 'whatsapp' ? ['COD', 'Online', 'KOKO'] : ['Cash', 'Online', 'KOKO']).map(label => (
            <button key={label} onClick={() => setPaymentMethod(label)} style={{
              flex: 1, padding: '7px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
              background: paymentMethod === label ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: paymentMethod === label ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--border-light)', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        {saleSource === 'whatsapp' && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '10px', borderRadius: '10px', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '11px', color: '#22c55e', textTransform: 'uppercase', marginBottom: '8px' }}>WhatsApp Order Details</h4>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Delivery Fee Charged (Rs)</label>
                <input type="number" min="0" placeholder="0.00" className="input-field" style={{ fontSize: '11px', width: '100%' }} value={whatsappShippingCharged} onChange={e => setWhatsappShippingCharged(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actual Courier Cost (Rs)</label>
                <input type="number" min="0" placeholder="0.00" className="input-field" style={{ fontSize: '11px', width: '100%' }} value={whatsappActualShipping} onChange={e => setWhatsappActualShipping(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid Amount (Rs)</label>
                <input type="number" min="0" placeholder="0.00" className="input-field" style={{ fontSize: '11px', width: '100%' }} value={whatsappPaidAmount} onChange={e => setWhatsappPaidAmount(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tracking Number</label>
                <input type="text" placeholder="e.g. DPX-12345" className="input-field" style={{ fontSize: '11px', width: '100%' }} value={whatsappTracking} onChange={e => setWhatsappTracking(e.target.value)} />
              </div>
            </div>
            
            <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b' }}>COD TO COLLECT:</span>
               <span style={{ fontSize: '14px', fontWeight: 800, color: '#f59e0b' }}>{fmtRs(computedCodAmount)}</span>
            </div>
          </div>
        )}

        {/* KOKO Charge Section */}
        {paymentMethod === 'KOKO' && (
          <div style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', padding: '10px', borderRadius: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '11px', color: '#a855f7', textTransform: 'uppercase', margin: 0 }}>KOKO Charge</h4>
              {saleSource === 'whatsapp' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" min="0" max="100" value={kokoPercentage} onChange={e => setKokoPercentage(e.target.value)} className="input-field" style={{ width: '50px', fontSize: '11px', padding: '3px 6px', textAlign: 'center' }} />
                  <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 700 }}>%</span>
                </div>
              )}
              {saleSource !== 'whatsapp' && (
                <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: 600 }}>10%</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Base Amount</span>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>{fmtRs(kokoBaseAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#a855f7' }}>KOKO Charge ({kokoPercentage}%)</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7' }}>+{fmtRs(kokoCharge)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px dashed rgba(168,85,247,0.3)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#a855f7' }}>KOKO FINAL TOTAL</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#a855f7' }}>{fmtRs(kokoFinalTotal)}</span>
            </div>
          </div>
        )}

        <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subtotal</span>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{fmtRs(subtotal)}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '7px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>TOTAL</span>
            <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-primary)' }}>{fmtRs(totalAmount)}</span>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>Est. Profit</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#10b981' }}>{fmtRs(totalProfit)}</span>
            </div>
          )}
        </div>

        <button className="btn-success" onClick={handleCheckout} disabled={processing || cart.length === 0} style={{ width: '100%', padding: '13px', justifyContent: 'center' }}>
          {processing ? 'Processing…' : `Complete Sale · ${fmtRs(paymentMethod === 'KOKO' ? kokoFinalTotal : totalAmount)}`}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Tab bar at top */}
      {isMobile && (
        <div style={{ marginBottom: '12px' }}>
          <h1 className="page-title" style={{ marginBottom: '10px' }}>POS / Billing</h1>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border-light)' }}>
            <button onClick={() => setMobileTab('products')} style={{
              flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: mobileTab === 'products' ? 'var(--accent-primary)' : 'transparent',
              color: mobileTab === 'products' ? 'white' : 'var(--text-muted)',
            }}>
              <Package size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Products
            </button>
            <button onClick={() => setMobileTab('cart')} style={{
              flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
              background: mobileTab === 'cart' ? 'var(--accent-primary)' : 'transparent',
              color: mobileTab === 'cart' ? 'white' : 'var(--text-muted)',
            }}>
              <ShoppingCart size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Cart
              {cart.length > 0 && (
                <span style={{
                  position: 'absolute', top: '4px', right: '8px',
                  background: '#ef4444', color: 'white',
                  borderRadius: '999px', fontSize: '9px', fontWeight: 800,
                  padding: '1px 5px',
                }}>
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mobile: single tab at a time */}
      {isMobile ? (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', overflow: 'hidden' }}>
          {mobileTab === 'products' ? ProductsPanel : CartPanel}
        </div>
      ) : (
        <div className="animate-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 390px', gap: '20px', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
          {ProductsPanel}
          {CartPanel}
        </div>
      )}

      {/* SUCCESS MODAL */}
      {successSale && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Sale Saved! ✅</h2>
            <div style={{ margin: '20px 0', textAlign: 'left' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Invoice No</span>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>{successSale.invoice_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Subtotal</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{fmtRs(successSale.subtotal)}</span>
                </div>
                {(successSale.total_discount > 0 || (successSale.items && successSale.items.some(i => i.discount > 0))) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Discount</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
                      -{fmtRs((successSale.total_discount || 0) + (successSale.items?.reduce((acc, i) => acc + ((i.discount || 0) * i.quantity), 0) || 0))}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', marginTop: '4px', borderTop: '1px dashed var(--border-light)' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: successSale.koko_charge > 0 ? 'var(--text-primary)' : '#10b981' }}>{fmtRs(successSale.total_amount)}</span>
                </div>
                {successSale.koko_charge > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#a855f7' }}>KOKO Charge ({successSale.koko_percentage || 10}%)</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#a855f7' }}>+{fmtRs(successSale.koko_charge)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', marginTop: '6px', borderTop: '2px solid #a855f7' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#a855f7' }}>Final Total</span>
                      <span style={{ fontSize: '20px', fontWeight: 900, color: '#a855f7' }}>{fmtRs(successSale.total_amount + successSale.koko_charge + (successSale.shipping_cost_charged || 0))}</span>
                    </div>
                  </>
                )}
              </div>
              {isAdmin && (
                <div style={{ background: 'rgba(16,185,129,0.1)', padding: '10px', borderRadius: '10px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>Net Profit</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>{fmtRs(successSale.total_profit)}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" onClick={() => { setSuccessSale(null); if (isMobile) setMobileTab('products'); }} style={{ flex: 1 }}>New Sale</button>
              <button className="btn-secondary" onClick={() => navigate('/sales')}>History</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}