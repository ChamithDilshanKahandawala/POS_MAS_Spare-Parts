import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { createSale } from '../api/services';
import toast from 'react-hot-toast';
import { Truck, Phone, Check, ArrowLeft, ShieldCheck, ShoppingCart, User, MapPin, Map } from 'lucide-react';
import AuthModal from '../components/AuthModal';

export default function CheckoutPage() {
  const { cart, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    district: '',
    phone1: '',
    phone2: ''
  });
  
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(!user);

  useEffect(() => {
    if (cart.length === 0 && !isCheckingOut) {
      toast.error('Your cart is empty');
      navigate('/');
    }
  }, [cart, navigate, isCheckingOut]);

  useEffect(() => {
    if (user && isAuthModalOpen) {
      setIsAuthModalOpen(false);
    }
  }, [user, isAuthModalOpen]);

  // Pre-fill fields if available
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.name || '',
        phone1: prev.phone1 || user.phone || ''
      }));
    }
  }, [user]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please login to place an order');
      setIsAuthModalOpen(true);
      return;
    }
    if (user.role !== 'customer') {
      toast.error('Only customers can place online orders here');
      return;
    }

    // Validations
    if (!formData.name.trim()) return toast.error('Name is required');
    if (!formData.address.trim() || formData.address.length < 5) return toast.error('Please provide a detailed address');
    if (!formData.city.trim() || formData.city.length < 2) return toast.error('City is required');
    if (!formData.district.trim()) return toast.error('District is required');
    
    // Sri Lanka phone validation (basic format checking)
    const phoneRegex = /^(?:0|94|\+94)?(?:7\d{8}|[1-9]\d{8})$/;
    const p1Clean = formData.phone1.replace(/\s+/g, '');
    
    if (!phoneRegex.test(p1Clean)) return toast.error('Phone Number 1 is invalid (e.g. 0771234567)');
    
    if (formData.phone2.trim()) {
      const p2Clean = formData.phone2.replace(/\s+/g, '');
      if (!phoneRegex.test(p2Clean)) return toast.error('Phone Number 2 is invalid (e.g. 0771234567)');
    }

    setIsCheckingOut(true);
    try {
      const fullAddress = `${formData.address}, ${formData.city}, ${formData.district}`;
      const customerPhoneCombined = formData.phone2.trim() ? `${formData.phone1} / ${formData.phone2}` : formData.phone1;

      const payload = {
        items: cart.map(i => ({ product_id: i._id, quantity: i.qty, discount: 0 })),
        payment_method: paymentMethod === 'card' ? 'Online' : 'Cash',
        sale_source: 'online',
        customer_name: formData.name,
        shipping_address: fullAddress,
        customer_phone: customerPhoneCombined,
      };
      
      await createSale(payload);
      toast.success('Order placed successfully! 🎉');
      clearCart();
      navigate('/orders'); // Redirect to order history
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (cart.length === 0) return null; // Will redirect in useEffect

  return (
    <div className="animate-fade" style={{ paddingBottom: '40px' }}>
      <button 
        onClick={() => navigate('/')} 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', fontWeight: 600 }}
      >
        <ArrowLeft size={16} /> Back to Store
      </button>

      <h1 className="page-title" style={{ marginBottom: '32px' }}>Secure Checkout</h1>

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Left Side: Forms */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              1. Delivery Details
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <User size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> Full Name *
                </label>
                <input 
                  type="text" name="name" className="input-field" 
                  placeholder="Enter your full name" style={{ width: '100%', borderRadius: '12px' }}
                  value={formData.name} onChange={handleChange} required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <Truck size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> Street Address *
                </label>
                <textarea 
                  name="address" className="input-field"
                  placeholder="Street name, house number, etc..."
                  style={{ width: '100%', borderRadius: '12px', minHeight: '60px', resize: 'vertical' }}
                  value={formData.address} onChange={handleChange} required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <MapPin size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> City *
                  </label>
                  <input 
                    type="text" name="city" className="input-field" 
                    placeholder="E.g. Colombo" style={{ width: '100%', borderRadius: '12px' }}
                    value={formData.city} onChange={handleChange} required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <Map size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> District *
                  </label>
                  <select 
                    name="district" className="select-field" style={{ width: '100%', borderRadius: '12px' }}
                    value={formData.district} onChange={handleChange} required
                  >
                    <option value="">Select District</option>
                    {['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Moneragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> Phone Number 1 *
                  </label>
                  <input 
                    type="tel" name="phone1" className="input-field" 
                    placeholder="e.g. 077 123 4567" style={{ width: '100%', borderRadius: '12px' }}
                    value={formData.phone1} onChange={handleChange} required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> Phone Number 2 (Optional)
                  </label>
                  <input 
                    type="tel" name="phone2" className="input-field" 
                    placeholder="Alternate number" style={{ width: '100%', borderRadius: '12px' }}
                    value={formData.phone2} onChange={handleChange}
                  />
                </div>
              </div>

            </div>
          </div>

          <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              2. Payment Method
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <button 
                onClick={() => setPaymentMethod('card')} 
                style={{ padding: '20px', borderRadius: '16px', border: paymentMethod === 'card' ? '2px solid var(--accent-primary)' : '2px solid var(--border)', background: paymentMethod === 'card' ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>💳</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>PayHere / Card</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Secure online payment</div>
              </button>
              
              <button 
                onClick={() => setPaymentMethod('cod')} 
                style={{ padding: '20px', borderRadius: '16px', border: paymentMethod === 'cod' ? '2px solid #10b981' : '2px solid var(--border)', background: paymentMethod === 'cod' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>💵</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Cash on Delivery</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Pay when received</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Order Summary */}
        <div style={{ flex: '1 1 350px' }}>
          <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', position: 'sticky', top: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <ShoppingCart size={18} /> Order Summary
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
              {cart.map(item => (
                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Qty: {item.qty} × Rs. {item.selling_price.toLocaleString()}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    Rs. {(item.selling_price * item.qty).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px dashed var(--border)', paddingTop: '24px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Subtotal</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Rs. {totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Shipping Estimate</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Calculated at Delivery</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Total</span>
                <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent-primary)' }}>Rs. {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <button 
              className="btn-primary" 
              onClick={handleCheckout}
              disabled={isCheckingOut || cart.length === 0}
              style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '16px', fontWeight: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: paymentMethod === 'cod' ? '#10b981' : '' }}
            >
              {isCheckingOut ? 'Processing...' : (
                <>
                  <ShieldCheck size={20} />
                  {paymentMethod === 'card' ? 'Pay Securely' : 'Place Order'}
                </>
              )}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', padding: '0 20px' }}>
              By placing your order, you agree to our Terms of Service and Privacy Policy.
            </div>
          </div>
        </div>

      </div>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => {
        setIsAuthModalOpen(false);
        if (!user) navigate('/'); // If they didn't login, bounce them back
      }} />
    </div>
  );
}
