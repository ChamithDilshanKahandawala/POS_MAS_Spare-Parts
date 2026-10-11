import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getProducts } from '../api/services';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, X, Star, ArrowRight, Info, ShieldCheck, Package, Eye, Filter, Truck, CheckCircle, Zap } from 'lucide-react';
import { useCart } from '../context/CartContext';

const CATEGORIES = ['All', 'Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road', 'KeyTag', 'Toys', 'Ornaments'];

export default function StorefrontPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [liveUpdatedIds, setLiveUpdatedIds] = useState(new Set());

  const { addToCart } = useCart();

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

  // Socket.io real-time stock sync
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', { transports: ['websocket', 'polling'] });
    socket.on('stock_updated', (updates) => {
      setProducts(prev =>
        prev.map(p => {
          const update = updates.find(u => u.productId === p._id);
          return update ? { ...p, stock_quantity: update.newQuantity } : p;
        })
      );
      const updatedIds = new Set(updates.map(u => u.productId));
      setLiveUpdatedIds(updatedIds);
      setTimeout(() => setLiveUpdatedIds(new Set()), 2500);
      setSelectedProduct(prev => {
        if (!prev) return prev;
        const update = updates.find(u => u.productId === prev._id);
        return update ? { ...prev, stock_quantity: update.newQuantity } : prev;
      });
    });
    return () => socket.disconnect();
  }, []);

  return (
    <>
      <div className="animate-fade">
        {/* ── Hero Section ── */}
        <div style={{
          background: 'var(--hero-gradient)',
          borderRadius: '20px', padding: '48px 40px', color: 'white',
          marginBottom: '40px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '32px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative shapes */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: '-60px', left: '30%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

          <div style={{ maxWidth: '560px', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
              <Zap size={13} /> Free shipping on orders above Rs. 5,000
            </div>
            <h2 style={{ fontSize: '34px', fontWeight: 900, marginBottom: '14px', lineHeight: 1.15 }}>
              Genuine Parts,<br/>Delivered Fast.
            </h2>
            <p style={{ fontSize: '15px', opacity: 0.92, marginBottom: '24px', lineHeight: 1.7, maxWidth: '460px' }}>
              Mudiyanse Auto Solutions offers the best quality spare parts for three-wheelers & bikes with guaranteed fitment and warranty.
            </p>
            <button 
              onClick={() => document.getElementById('catalog').scrollIntoView({behavior: 'smooth'})}
              style={{
                background: 'white', color: 'var(--accent-primary)', border: 'none',
                padding: '13px 28px', fontSize: '15px', fontWeight: 700,
                borderRadius: '12px', cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '8px', transition: 'all 0.25s',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              Browse Catalog <ArrowRight size={16} />
            </button>
          </div>

          {/* Hero right — trust indicators */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            {[
              { icon: ShieldCheck, label: 'Genuine', sub: 'OEM Parts' },
              { icon: Truck, label: 'Island-wide', sub: 'Delivery' },
              { icon: CheckCircle, label: 'Warranty', sub: 'Guaranteed' },
            ].map(t => (
              <div key={t.label} style={{
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                borderRadius: '16px', padding: '20px 18px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.2)', minWidth: '110px',
              }}>
                <t.icon size={26} style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: '14px', fontWeight: 800 }}>{t.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{t.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Search and Filter Bar ── */}
        <div id="catalog" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '24px', flexWrap: 'wrap', gap: '16px',
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Our Catalog</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              {products.length} quality parts available
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '600px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" placeholder="Search parts by name or SKU..." 
                className="input-field"
                style={{ paddingLeft: '36px', width: '100%', borderRadius: '12px' }}
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            {/* Category pills */}
            <div style={{
              display: 'flex', gap: '4px', padding: '3px',
              background: 'var(--bg-secondary)', borderRadius: '12px',
              border: '1px solid var(--border-light)',
            }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: '7px 14px', borderRadius: '9px', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer', border: 'none',
                  whiteSpace: 'nowrap', transition: 'all 0.2s',
                  background: category === c
                    ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                    : 'transparent',
                  color: category === c ? 'white' : 'var(--text-muted)',
                }}>{c}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Product Grid ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{
                height: '260px', background: 'var(--bg-card)', borderRadius: '16px',
                border: '1px solid var(--border-light)',
                backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
                backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
              }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <Package size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontWeight: 600, fontSize: '15px' }}>No products found.</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Try adjusting your search or category filter.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px', paddingBottom: '40px' }}>
            {products.map((p, idx) => {
              const isLiveUpdated = liveUpdatedIds.has(p._id);
              const outOfStock = p.stock_quantity <= 0;
              return (
                <div 
                  key={p._id} 
                  className="product-card-enter"
                  style={{
                    background: 'var(--bg-card)', borderRadius: '16px',
                    border: `1px solid ${isLiveUpdated ? '#27ae60' : 'var(--border-light)'}`,
                    boxShadow: isLiveUpdated ? '0 0 0 3px rgba(39,174,96,0.15)' : 'var(--card-shadow)',
                    display: 'flex', flexDirection: 'column', cursor: 'pointer',
                    transition: 'all 0.3s ease', overflow: 'hidden',
                    animationDelay: `${idx * 0.04}s`,
                    opacity: outOfStock ? 0.6 : 1,
                  }}
                  onClick={() => setSelectedProduct(p)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
                >
                  {/* Product image placeholder */}
                  <div style={{
                    height: '140px', background: 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', borderBottom: '1px solid var(--border-light)',
                  }}>
                    <Package size={40} color="var(--text-muted)" style={{ opacity: 0.15 }} />
                    {/* Stock badge overlay */}
                    <span style={{
                      position: 'absolute', top: '10px', left: '10px',
                      fontSize: '10px', fontWeight: 700, padding: '4px 10px',
                      borderRadius: '20px',
                      background: p.stock_quantity > 10 ? 'rgba(39,174,96,0.12)' : p.stock_quantity > 0 ? 'rgba(243,156,18,0.12)' : 'rgba(231,76,60,0.12)',
                      color: p.stock_quantity > 10 ? '#27ae60' : p.stock_quantity > 0 ? '#f39c12' : '#e74c3c',
                      border: `1px solid ${p.stock_quantity > 10 ? 'rgba(39,174,96,0.25)' : p.stock_quantity > 0 ? 'rgba(243,156,18,0.25)' : 'rgba(231,76,60,0.25)'}`,
                    }}>
                      {p.stock_quantity > 0 ? `${p.stock_quantity} in stock` : 'Out of Stock'}
                    </span>
                    {isLiveUpdated && (
                      <span style={{
                        position: 'absolute', top: '10px', right: '10px',
                        fontSize: '9px', fontWeight: 700, color: '#27ae60',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(39,174,96,0.1)', padding: '3px 8px',
                        borderRadius: '12px', border: '1px solid rgba(39,174,96,0.2)',
                      }}>
                        <span style={{ width: '6px', height: '6px', background: '#27ae60', borderRadius: '50%', animation: 'pulse-glow 1s infinite' }} />
                        LIVE
                      </span>
                    )}
                    {/* Quick view overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.03)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                    >
                      <span style={{
                        background: 'var(--accent-primary)', color: 'white',
                        padding: '8px 16px', borderRadius: '8px', fontSize: '12px',
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                      }}><Eye size={14} /> Quick View</span>
                    </div>
                  </div>

                  {/* Card content */}
                  <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {p.category}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.sku_code}</span>
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', lineHeight: 1.3 }}>{p.name}</h3>
                    
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                        Rs. {p.selling_price.toLocaleString()}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                        disabled={outOfStock}
                        style={{
                          padding: '8px 14px', borderRadius: '8px', fontSize: '12px',
                          fontWeight: 700, cursor: outOfStock ? 'not-allowed' : 'pointer',
                          border: 'none', display: 'flex', alignItems: 'center', gap: '5px',
                          background: outOfStock ? 'var(--bg-secondary)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                          color: outOfStock ? 'var(--text-muted)' : 'white',
                          transition: 'all 0.2s',
                        }}
                      >
                        <ShoppingCart size={13} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Product Quick View Modal ── */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{
            maxWidth: '800px', display: 'flex', gap: '32px', flexWrap: 'wrap', padding: '0', overflow: 'hidden',
          }}>
            {/* Left — Image area */}
            <div style={{
              flex: '1 1 300px', background: 'var(--bg-secondary)', minHeight: '320px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              <Package size={64} color="var(--text-muted)" style={{ opacity: 0.1 }} />
              <span style={{
                position: 'absolute', top: '16px', left: '16px',
              }} className={`badge ${selectedProduct.stock_quantity > 10 ? 'badge-green' : selectedProduct.stock_quantity > 0 ? 'badge-yellow' : 'badge-red'}`}>
                {selectedProduct.stock_quantity > 0 ? `${selectedProduct.stock_quantity} in stock` : 'Out of Stock'}
              </span>
            </div>
            
            {/* Right — Info */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', padding: '28px 28px 28px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {selectedProduct.category}
                </span>
                <button onClick={() => setSelectedProduct(null)} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                  borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}><X size={16} /></button>
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: 1.2 }}>{selectedProduct.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>
                SKU: <span style={{ fontFamily: 'monospace' }}>{selectedProduct.sku_code}</span>
              </p>

              <div style={{
                padding: '14px 16px', background: 'var(--bg-secondary)',
                borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-light)',
              }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Product Description</strong><br/>
                  <span style={{ opacity: 0.85 }}>
                    Ideal replacement part for {selectedProduct.category.toLowerCase()} vehicles. 
                    100% genuine fitting guaranteed with warranty on manufacturing defects.
                  </span>
                </p>
              </div>

              {/* Trust indicators */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {[
                  { icon: ShieldCheck, label: '100% Genuine' },
                  { icon: Truck, label: 'Fast Delivery' },
                  { icon: CheckCircle, label: 'Warranty' },
                ].map(t => (
                  <div key={t.label} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)', padding: '5px 10px',
                    borderRadius: '8px', border: '1px solid var(--border-light)',
                  }}>
                    <t.icon size={12} color="var(--accent-primary)" /> {t.label}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--accent-primary)', marginBottom: '16px' }}>
                  Rs. {selectedProduct.selling_price.toLocaleString()}
                </div>
                <button 
                  onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  disabled={selectedProduct.stock_quantity <= 0}
                  className="btn-primary"
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px',
                    fontSize: '15px', justifyContent: 'center',
                  }}
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
