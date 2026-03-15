import { useState, useEffect, useCallback } from 'react';
import { getProducts, createSale } from '../api/services';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Plus, Minus, X, Check, Truck, Star, ArrowRight, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['All', 'Three-wheel', 'Bike', 'Car', 'Van'];

export default function StorefrontPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) { toast.error('Out of stock!'); return; }
    setCart(prev => {
      const existing = prev.find(i => i._id === product._id);
      if (existing) {
        if (existing.qty >= product.stock_quantity) { toast.error('Max stock reached!'); return prev; }
        return prev.map(i => i._id === product._id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i._id === id) {
        const newQty = i.qty + delta;
        if (newQty > i.stock_quantity) { toast.error('Not enough stock'); return i; }
        if (newQty < 1) return i;
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i._id !== id));

  const totalAmount = cart.reduce((sum, item) => sum + (item.selling_price * item.qty), 0);

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please login to place an order');
      navigate('/login');
      return;
    }
    if (user.role !== 'customer') {
      toast.error('Only customers can place online orders here');
      return;
    }
    if (!shippingAddress.trim()) {
      toast.error('Shipping address is required');
      return;
    }
    
    setIsCheckingOut(true);
    try {
      const payload = {
        items: cart.map(i => ({ product_id: i._id, quantity: i.qty, discount: 0 })),
        payment_method: paymentMethod === 'card' ? 'Online' : 'Cash',
        sale_source: 'online',
        shipping_address: shippingAddress,
      };
      
      await createSale(payload);
      toast.success('Order placed successfully!');
      setCart([]);
      setIsCartOpen(false);
      setShippingAddress('');
      fetchProducts(); // Refresh stock
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      <div className="animate-fade">
        {/* Hero Section */}
        <div style={{
          background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
          borderRadius: '24px',
          padding: '48px',
          color: 'white',
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '32px',
          boxShadow: '0 20px 40px rgba(99, 102, 241, 0.2)'
        }}>
          <div style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px', lineHeight: 1.2 }}>Genuine Parts, Delivered Fast.</h2>
            <p style={{ fontSize: '16px', opacity: 0.9, marginBottom: '24px', lineHeight: 1.6 }}>
              Mudiyanse Auto Solutions offers the best quality spare parts for three-wheelers and bikes with guaranteed fitment and warranty.
            </p>
            <button 
              onClick={() => document.getElementById('catalog').scrollIntoView({behavior: 'smooth'})}
              className="btn-secondary" 
              style={{ background: 'white', color: 'var(--accent-primary)', border: 'none', padding: '12px 24px', fontSize: '16px' }}
            >
              Shop Now <ArrowRight size={18} />
            </button>
          </div>
          <div style={{ flex: 1, minWidth: '280px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '320px', height: '240px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
               <Star size={48} color="#fcd34d" fill="#fcd34d" />
               <div style={{ textAlign: 'center' }}>
                 <div style={{ fontSize: '24px', fontWeight: 800 }}>Premium Quality</div>
                 <div style={{ fontSize: '14px', opacity: 0.8 }}>100% Guaranteed</div>
               </div>
            </div>
          </div>
        </div>

      {/* Search and Filters */}
      <div id="catalog" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>Genuine Spare Parts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Find exactly what you need.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '600px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" placeholder="Search parts by name or SKU..." 
              className="input-field"
              style={{ paddingLeft: '36px', width: '100%', borderRadius: '12px' }}
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="select-field"
            style={{ width: '150px', borderRadius: '12px' }}
            value={category} onChange={e => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button 
            className="btn-primary" 
            onClick={() => setIsCartOpen(true)}
            style={{ borderRadius: '12px', padding: '10px 16px', position: 'relative' }}
          >
            <ShoppingCart size={18} />
            {cart.length > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 800, width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading products...</div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No products found.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', paddingBottom: '40px' }}>
          {products.map(p => (
            <div 
              key={p._id} 
              className="glass-card" 
              style={{ padding: '20px', display: 'flex', flexDirection: 'column', borderRadius: '16px', cursor: 'pointer' }}
              onClick={() => setSelectedProduct(p)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span className={`badge ${p.stock_quantity > 10 ? 'badge-green' : p.stock_quantity > 0 ? 'badge-yellow' : 'badge-red'}`}>
                  {p.stock_quantity > 0 ? `${p.stock_quantity} in stock` : 'Out of Stock'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.sku_code}</span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{p.name}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>{p.category}</p>
              
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  Rs. {p.selling_price.toLocaleString()}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                  disabled={p.stock_quantity <= 0}
                  className="btn-primary"
                  style={{ padding: '8px 12px', borderRadius: '8px', opacity: p.stock_quantity <= 0 ? 0.5 : 1 }}
                >
                  <ShoppingCart size={14} /> Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      {/* Cart Drawer - OUTSIDE animate-fade */}
      {isCartOpen && (
        <>
          <div className="modal-overlay" onClick={() => setIsCartOpen(false)} style={{ zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '100%',
            background: 'var(--bg-card)', zIndex: 1001, display: 'flex', flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', transition: 'transform 0.3s ease'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={20} color="#6366f1" /> Your Cart
              </h2>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>Your cart is empty.</div>
              ) : (
                cart.map(item => (
                  <div key={item._id} style={{ display: 'flex', gap: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{item.name}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)' }}>Rs. {(item.selling_price * item.qty).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => updateQty(item._id, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                      <span style={{ fontSize: '13px', fontWeight: 600, width: '16px', textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => updateQty(item._id, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                      <button onClick={() => removeFromCart(item._id)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}><X size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '18px', fontWeight: 800 }}>
                <span>Total:</span>
                <span style={{ color: 'var(--accent-primary)' }}>Rs. {totalAmount.toLocaleString()}</span>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}><Truck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Shipping Address</label>
                <textarea 
                   className="input-field"
                  placeholder="Enter your full address..."
                  style={{ width: '100%', borderRadius: '12px', minHeight: '80px', resize: 'vertical' }}
                  value={shippingAddress} onChange={e => setShippingAddress(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Payment Method (Simulated)</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setPaymentMethod('card')} className={paymentMethod === 'card' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '10px', justifyContent: 'center' }}>💳 PayHere / Card</button>
                  <button onClick={() => setPaymentMethod('cod')} className={paymentMethod === 'cod' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '10px', justifyContent: 'center', background: paymentMethod === 'cod' ? '#10b981' : '' }}>💵 Cash on Delivery</button>
                </div>
              </div>

              <button 
                className="btn-primary" 
                onClick={handleCheckout}
                disabled={cart.length === 0 || isCheckingOut || !shippingAddress.trim()}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '16px', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                {isCheckingOut ? 'Processing...' : <><Check size={18} /> Place Order</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Product Quick View Modal */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', background: 'var(--bg-secondary)', borderRadius: '16px', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {/* Gallery Placeholder */}
               <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                 <Info size={64} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                 <p>Rich Media Gallery<br/><small>(Coming Soon)</small></p>
               </div>
            </div>
            
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <span className={`badge ${selectedProduct.stock_quantity > 10 ? 'badge-green' : selectedProduct.stock_quantity > 0 ? 'badge-yellow' : 'badge-red'}`} style={{ marginBottom: '8px' }}>
                    {selectedProduct.stock_quantity > 0 ? `${selectedProduct.stock_quantity} in stock` : 'Out of Stock'}
                  </span>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedProduct.name}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>SKU: <span style={{ fontFamily: 'monospace' }}>{selectedProduct.sku_code}</span> • Category: {selectedProduct.category}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '24px' }}>
                 <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                   <strong>Product Description:</strong><br/>
                   <span style={{ opacity: 0.8 }}>Detailed rich-text descriptions will appear here. Currently viewing standard catalog specifications. Ideal replacement part for {selectedProduct.category.toLowerCase()} vehicles. 100% Genuine fitting guaranteed.</span>
                 </p>
              </div>

              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-primary)', marginBottom: '16px' }}>
                  Rs. {selectedProduct.selling_price.toLocaleString()}
                </div>
                <button 
                  onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  disabled={selectedProduct.stock_quantity <= 0}
                  className="btn-primary"
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', fontSize: '16px', justifyContent: 'center' }}
                >
                  <ShoppingCart size={18} /> Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
