import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { createSale } from '../api/services';
import toast from 'react-hot-toast';
import { Truck, Phone, Check, ArrowLeft, ShieldCheck, ShoppingCart, User, MapPin, Map, Loader2 } from 'lucide-react';
import { formatLKR, formatAmount } from '../utils/formatLKR';
import { DELIVERY_OPTIONS, getSellerForProduct } from '../config/store';

// This page only ever mounts via the /checkout route, which is wrapped in
// <CustomerRoute> (see App.jsx) — a logged-out visitor, or a non-customer
// account, is redirected to /login (carrying this path as router state so
// LoginPage can send them back) before CheckoutPage ever renders. So no
// login/role gate is needed here.
const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota',
  'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara',
  'Moneragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];

export default function CheckoutPage() {
  const { t } = useTranslation(['checkout', 'common', 'platform']);
  const { cart, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Pre-filled directly from `user` on mount, not via an effect: this page
  // only ever mounts already wrapped in <CustomerRoute> (see App.jsx), so a
  // logged-in customer is guaranteed to be present before the first render
  // — there's no async gap where `user` could arrive later and need an
  // effect to sync it in.
  const [formData, setFormData] = useState(() => ({
    name: user?.name || '',
    address: '',
    city: '',
    district: '',
    phone1: user?.phone || '',
    phone2: ''
  }));

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // Set the instant checkout succeeds, so the empty-cart redirect below can't
  // fire off the back of clearCart() and race the navigate() call.
  const orderPlacedRef = useRef(false);
  // One id for this checkout attempt, generated once on mount (lazy
  // initializer, not a ref write during render — see the react-hooks/refs
  // note elsewhere in this codebase for why that distinction matters here).
  // Sent as idempotencyKey on every submit, including retries after a
  // failed attempt, so two requests that reach the backend for the same
  // attempt (a real double-click that slips past the disabled button, or a
  // dropped-response network retry) resolve to the same sale server-side
  // instead of creating two (see createSale's idempotency_key handling).
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (cart.length === 0 && !orderPlacedRef.current) {
      toast.error(t('toast.cartEmpty'));
      navigate('/');
    }
    // `t` deliberately excluded — see the identical note in
    // StorefrontPage.jsx's fetchProducts; it's always live-bound so a
    // stale closure reference still returns current-language text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, navigate]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleCheckout = async () => {
    // Belt-and-suspenders against the button's disabled state lagging a
    // tick behind a genuine rapid double-click — idempotencyKey below is
    // the real, server-enforced guarantee; this just avoids firing a
    // second request at all when we can.
    if (isCheckingOut) return;

    // Checked before validation so a reconnect-and-retry doesn't also need
    // to re-clear every field error first — this is the one that actually
    // explains why the submit will fail right now.
    if (!navigator.onLine) return toast.error(t('pwa:offlineCheckout'));

    // Validations
    if (!formData.name.trim()) return toast.error(t('toast.nameRequired'));
    if (!formData.address.trim() || formData.address.length < 5) return toast.error(t('toast.addressRequired'));
    if (!formData.city.trim() || formData.city.length < 2) return toast.error(t('toast.cityRequired'));
    if (!formData.district.trim()) return toast.error(t('toast.districtRequired'));
    
    // Sri Lanka phone validation (basic format checking)
    const phoneRegex = /^(?:0|94|\+94)?(?:7\d{8}|[1-9]\d{8})$/;
    const p1Clean = formData.phone1.replace(/\s+/g, '');
    
    if (!phoneRegex.test(p1Clean)) return toast.error(t('toast.phone1Invalid'));
    
    if (formData.phone2.trim()) {
      const p2Clean = formData.phone2.replace(/\s+/g, '');
      if (!phoneRegex.test(p2Clean)) return toast.error(t('toast.phone2Invalid'));
    }

    if (!agreedToTerms) return toast.error(t('toast.termsRequired'));

    setIsCheckingOut(true);
    try {
      const fullAddress = `${formData.address}, ${formData.city}, ${formData.district}`;
      const customerPhoneCombined = formData.phone2.trim() ? `${formData.phone1} / ${formData.phone2}` : formData.phone1;

      const payload = {
        items: cart.map(i => ({ product_id: i._id, quantity: i.qty, discount: 0 })),
        // TODO: 'Online' (PayHere/Card) was removed as a checkout option — no payment
        // gateway was ever wired up, so it only recorded 'Online' without charging
        // anything. Every storefront order is Cash on Delivery until a real gateway
        // with server-side payment verification is integrated.
        payment_method: 'Cash',
        sale_source: 'online',
        customer_name: formData.name,
        shipping_address: fullAddress,
        customer_phone: customerPhoneCombined,
        idempotencyKey,
      };

      const { data: sale } = await createSale(payload);
      orderPlacedRef.current = true;
      clearCart();
      // `replace` so the back button from order-success lands wherever the
      // customer was before checkout, not back on a filled-in checkout form
      // for an order that's already been placed.
      navigate(`/order-success/${sale._id}`, { replace: true, state: { sale } });
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.checkoutFailed'));
      setIsCheckingOut(false);
    }
  };

  if (cart.length === 0) return null; // Will redirect in useEffect

  // Grouped by seller — every product resolves to the same seller today
  // (getSellerForProduct), so this always renders one group, but the order
  // summary is built to already show "Sold by X" per group rather than
  // needing a rewrite once a second seller's products can end up in the
  // same cart.
  const sellerGroups = [];
  for (const item of cart) {
    const seller = getSellerForProduct(item);
    let group = sellerGroups.find((g) => g.seller.id === seller.id);
    if (!group) { group = { seller, items: [] }; sellerGroups.push(group); }
    group.items.push(item);
  }

  return (
    <div className="animate-fade" style={{ paddingBottom: '40px' }}>
      <button 
        onClick={() => navigate('/')} 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', fontWeight: 600 }}
      >
        <ArrowLeft size={16} /> {t('common:nav.backToStore')}
      </button>

      <h1 className="page-title" style={{ marginBottom: '32px' }}>{t('title')}</h1>

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Left Side: Forms */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              {t('delivery.heading')}
            </h2>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600,
              color: 'var(--text-muted)', marginBottom: '24px',
            }}>
              <Truck size={13} color="var(--accent-primary)" /> {t('delivery.courierNote')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <User size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> {t('delivery.fullName')}
                </label>
                <input 
                  type="text" name="name" className="input-field" 
                  placeholder={t('delivery.fullNamePlaceholder')} style={{ width: '100%', borderRadius: '12px' }}
                  value={formData.name} onChange={handleChange} required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <Truck size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> {t('delivery.streetAddress')}
                </label>
                <textarea 
                  name="address" className="input-field"
                  placeholder={t('delivery.streetAddressPlaceholder')}
                  style={{ width: '100%', borderRadius: '12px', minHeight: '60px', resize: 'vertical' }}
                  value={formData.address} onChange={handleChange} required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <MapPin size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> {t('delivery.city')}
                  </label>
                  <input 
                    type="text" name="city" className="input-field" 
                    placeholder={t('delivery.cityPlaceholder')} style={{ width: '100%', borderRadius: '12px' }}
                    value={formData.city} onChange={handleChange} required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <Map size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> {t('delivery.district')}
                  </label>
                  <select 
                    name="district" className="select-field" style={{ width: '100%', borderRadius: '12px' }}
                    value={formData.district} onChange={handleChange} required
                  >
                    <option value="">{t('delivery.selectDistrict')}</option>
                    {DISTRICTS.map(d => (
                      <option key={d} value={d}>{t(`districts.${d}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> {t('delivery.phone1')}
                  </label>
                  <input 
                    type="tel" name="phone1" className="input-field" 
                    placeholder={t('delivery.phone1Placeholder')} style={{ width: '100%', borderRadius: '12px' }}
                    value={formData.phone1} onChange={handleChange} required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <Phone size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} /> {t('delivery.phone2')}
                  </label>
                  <input 
                    type="tel" name="phone2" className="input-field" 
                    placeholder={t('delivery.phone2Placeholder')} style={{ width: '100%', borderRadius: '12px' }}
                    value={formData.phone2} onChange={handleChange}
                  />
                </div>
              </div>

            </div>
          </div>

          <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              {t('payment.heading')}
            </h2>
            {/* TODO: The "PayHere / Card" online payment option was removed from here.
                It never integrated with a real payment gateway — selecting it only sent
                payment_method: 'Online' to the backend with no charge actually taken,
                which let customers believe they'd paid when they hadn't. Only restore
                an online option once PayHere (or another gateway) is integrated with
                real server-side payment verification. */}
            <div style={{ padding: '20px', borderRadius: '16px', border: '2px solid #10b981', background: 'rgba(16, 185, 129, 0.05)', textAlign: 'center', maxWidth: '260px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>💵</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t('payment.cashOnDelivery')}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('payment.payWhenReceived')}</div>
            </div>
          </div>
        </div>

        {/* Right Side: Order Summary */}
        {/* `position: sticky` lives on this outer flex-item wrapper, not the
            inner .glass-card — sticky can only move within its own direct
            parent's box, and a wrapper that only ever shrink-wraps its single
            child (as this one otherwise would) gives it zero room to stick,
            regardless of how much taller the sibling column is. */}
        <div style={{ flex: '1 1 350px', position: 'sticky', top: '24px' }}>
          <div className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <ShoppingCart size={18} /> {t('summary.heading')}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
              {sellerGroups.map((group) => (
                <div key={group.seller.id}>
                  <div style={{
                    fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px',
                  }}>
                    {t('platform:soldBy', { seller: group.seller.name })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {group.items.map(item => (
                      <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('summary.qtyLine', { count: item.qty, price: formatLKR(item.selling_price) })}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatLKR(item.selling_price * item.qty)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px dashed var(--border)', paddingTop: '24px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{t('summary.subtotal')}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatLKR(totalAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{t('summary.shippingEstimate')}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t('summary.calculatedAtDelivery', { price: formatAmount(DELIVERY_OPTIONS[0].pricing.westernFirstKg) })}
                </span>
              </div>
              <div style={{ textAlign: 'right', marginBottom: '12px' }}>
                <Link to="/delivery" style={{ fontSize: '11.5px', color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>
                  {t('summary.viewDeliveryOptions')}
                </Link>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('summary.total')}</span>
                <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent-primary)' }}>{formatLKR(totalAmount)}</span>
              </div>
            </div>

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '9px', marginBottom: '14px',
              fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.5,
            }}>
              <input
                type="checkbox" checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--accent-primary)' }}
              />
              <Trans
                i18nKey="checkout:summary.termsCheckbox"
                components={[
                  <Link key="0" to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />,
                  <Link key="2" to="/returns" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />,
                ]}
              />
            </label>

            <button
              className="btn-primary"
              onClick={handleCheckout}
              disabled={isCheckingOut || cart.length === 0}
              style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '16px', fontWeight: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: '#10b981', opacity: isCheckingOut ? 0.8 : 1 }}
            >
              {isCheckingOut ? (
                <>
                  <Loader2 size={20} className="spin" />
                  {t('summary.processing')}
                </>
              ) : (
                <>
                  <ShieldCheck size={20} />
                  {t('summary.placeOrder')}
                </>
              )}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', padding: '0 20px' }}>
              <Trans
                i18nKey="checkout:summary.privacyNotice"
                components={[<Link key="0" to="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />]}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
