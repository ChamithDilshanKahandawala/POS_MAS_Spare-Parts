import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ArrowLeft, MessageCircle, ShoppingCart, Clock, MapPin, Truck, ShieldCheck,
  Loader2, Plus, Star, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getItemSeller } from '../api/marketplaceAdapters';
import {
  getPublicSettings, getCustomerAddresses, createCustomerAddress,
  previewCheckout, placeOrder,
} from '../api/marketplaceServices';
import { formatLKR } from '../utils/formatLKR';
import { PLATFORM_INFO } from '../config/store';
import { SRI_LANKA_DISTRICTS } from '../utils/districts';

// Milestone 5 Part A's original "coming soon" screen — unchanged, still
// shown whenever onlineOrderingEnabled is off (the default), see
// CheckoutPageMarketplace below.
function ComingSoonCheckout() {
  const { t } = useTranslation(['checkout', 'common', 'marketplace']);
  const { cart, totalAmount } = useCart();
  const navigate = useNavigate();

  const sellerGroups = [];
  for (const item of cart) {
    const seller = getItemSeller(item);
    let group = sellerGroups.find((g) => g.seller.slug === seller.slug || g.seller.id === seller.id);
    if (!group) { group = { seller, items: [] }; sellerGroups.push(group); }
    group.items.push(item);
  }

  const messageLines = [
    t('marketplace:checkoutComingSoon.whatsappIntro'),
    '',
    ...sellerGroups.flatMap((g) => [
      t('marketplace:checkoutComingSoon.soldBy', { seller: g.seller.name }),
      ...g.items.map((i) => `• ${i.name} x${i.qty} — ${formatLKR(i.selling_price * i.qty)}`),
      '',
    ]),
    t('marketplace:checkoutComingSoon.total', { total: formatLKR(totalAmount) }),
  ];
  const whatsappHref = `https://wa.me/${PLATFORM_INFO.supportWhatsapp}?text=${encodeURIComponent(messageLines.join('\n'))}`;

  return (
    <div className="animate-fade" style={{ paddingBottom: '40px', maxWidth: '640px', margin: '0 auto' }}>
      <button onClick={() => navigate('/cart')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', fontWeight: 600 }}>
        <ArrowLeft size={16} /> {t('common:nav.backToStore')}
      </button>

      <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', textAlign: 'center', marginBottom: '24px' }}>
        <Clock size={40} color="var(--accent-primary)" style={{ margin: '0 auto 16px', display: 'block' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          {t('marketplace:checkoutComingSoon.title')}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '24px' }}>
          {t('marketplace:checkoutComingSoon.body')}
        </p>
        <a
          href={whatsappHref} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
            background: '#128037', color: 'white', textDecoration: 'none',
            padding: '14px 24px', borderRadius: '14px', fontSize: '15px', fontWeight: 700,
            boxShadow: '0 4px 14px rgba(37,211,102,0.28)',
          }}
        >
          <MessageCircle size={18} /> {t('marketplace:checkoutComingSoon.orderOnWhatsapp')}
        </a>
      </div>

      <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingCart size={16} /> {t('summary.heading')}
        </h2>
        {sellerGroups.map((group) => (
          <div key={group.seller.id || group.seller.slug} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
              {t('marketplace:checkoutComingSoon.soldBy', { seller: group.seller.name })}
            </div>
            {group.items.map((item) => (
              <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{item.name} × {item.qty}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatLKR(item.selling_price * item.qty)}</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '2px dashed var(--border)' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('summary.total')}</span>
          <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent-primary)' }}>{formatLKR(totalAmount)}</span>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <Link to="/cart" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{t('marketplace:checkoutComingSoon.backToCart')}</Link>
      </p>
    </div>
  );
}

const ISSUE_MESSAGE_KEY = {
  not_found: 'marketplace:checkout.issues.notFound',
  no_longer_available: 'marketplace:checkout.issues.noLongerAvailable',
  insufficient_stock: 'marketplace:checkout.issues.insufficientStock',
  price_changed: 'marketplace:checkout.issues.priceChanged',
  temporarily_unavailable: 'marketplace:checkout.issues.temporarilyUnavailable',
};

const emptyAddressForm = { label: '', line1: '', line2: '', city: '', district: '', landmark: '', phone: '' };

// Milestone 6 Part C — the real, logged-in checkout flow: address ->
// review -> place order. Only ever reachable when the platform owner has
// turned onlineOrderingEnabled on (checked server-side too, independent
// of this UI — see services/orderCreation.js); otherwise this renders
// exactly the Milestone 5 "coming soon" screen above, unchanged.
function RealCheckout() {
  const { t } = useTranslation(['checkout', 'common', 'marketplace', 'account']);
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();
  // Set the instant checkout succeeds, so the empty-cart redirect effect
  // below can't fire off the back of clearCart() and race the
  // post-order navigate() call — same pattern (and same bug class) as
  // CheckoutPagePos.jsx's orderPlacedRef.
  const orderPlacedRef = useRef(false);

  const [step, setStep] = useState('address');
  const [addresses, setAddresses] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [adding, setAdding] = useState(false);
  const [addrForm, setAddrForm] = useState(emptyAddressForm);
  const [customerNote, setCustomerNote] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [issues, setIssues] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const loadAddresses = useCallback(() => {
    getCustomerAddresses().then(({ data }) => {
      setAddresses(data.addresses);
      const def = data.addresses.find((a) => a.isDefault) || data.addresses[0];
      if (def) setSelectedAddressId(def._id);
    }).catch(() => toast.error(t('common:error.generic')));
  }, [t]);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  useEffect(() => {
    if (cart.length === 0 && !orderPlacedRef.current) navigate('/', { replace: true });
  }, [cart, navigate]);

  const checkoutItems = () => cart.map((i) => ({
    listingId: i._id, qty: i.qty, expectedPriceCents: Math.round(i.selling_price * 100),
  }));

  const submitNewAddress = async (e) => {
    e.preventDefault();
    try {
      const { data } = await createCustomerAddress(addrForm);
      toast.success(t('account:addresses.added'));
      setAdding(false);
      setAddrForm(emptyAddressForm);
      setAddresses(data.addresses);
      const created = data.addresses[data.addresses.length - 1];
      setSelectedAddressId(created._id);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const goToReview = async () => {
    if (!selectedAddressId) return toast.error(t('marketplace:checkout.selectAddressFirst'));
    setPreviewLoading(true);
    setIssues([]);
    try {
      const { data } = await previewCheckout({ addressId: selectedAddressId, items: checkoutItems() });
      setPreview(data);
      setStep('review');
    } catch (err) {
      if (err.response?.status === 409) setIssues(err.response.data.issues || []);
      else toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!agreedToTerms) return toast.error(t('toast.termsRequired'));
    setPlacing(true);
    setIssues([]);
    try {
      const { data } = await placeOrder({
        addressId: selectedAddressId, items: checkoutItems(), customerNote, idempotencyKey,
      });
      orderPlacedRef.current = true;
      clearCart();
      navigate(`/order-success/${data.order.orderNumber}`, { replace: true, state: { order: data.order, sellerOrders: data.sellerOrders } });
    } catch (err) {
      if (err.response?.status === 409) {
        setIssues(err.response.data.issues || []);
        setStep('address');
        toast.error(t('marketplace:checkout.issues.heading'));
      } else {
        toast.error(err.response?.data?.message || t('toast.checkoutFailed'));
      }
      setPlacing(false);
    }
  };

  const findCartItem = (listingId) => cart.find((i) => i._id === listingId);

  // The redirect itself lives in the effect above — navigating during
  // render is what caused the race with the post-order navigate() call
  // (clearCart() synchronously empties the cart, which re-renders this
  // component before the order-success navigate() has taken effect).
  // This just suppresses the one frame where cart is already empty but
  // the effect hasn't redirected yet.
  if (cart.length === 0 && !orderPlacedRef.current) return null;

  return (
    <div className="animate-fade" style={{ paddingBottom: '40px', maxWidth: '680px', margin: '0 auto' }}>
      <button onClick={() => navigate('/cart')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', fontWeight: 600 }}>
        <ArrowLeft size={16} /> {t('common:nav.backToStore')}
      </button>

      <h1 className="page-title" style={{ marginBottom: '8px' }}>{t('title')}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '24px', fontWeight: 600 }}>
        <span style={{ color: step === 'address' ? 'var(--accent-primary)' : 'inherit' }}>{t('marketplace:checkout.stepAddress')}</span>
        <ChevronRight size={12} />
        <span style={{ color: step === 'review' ? 'var(--accent-primary)' : 'inherit' }}>{t('marketplace:checkout.stepReview')}</span>
      </div>

      {issues.length > 0 && (
        <div className="glass-card" style={{ padding: '16px 18px', borderRadius: '14px', marginBottom: '20px', border: '1px solid var(--accent-red)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--accent-red)', marginBottom: '8px', fontSize: '13px' }}>
            <AlertTriangle size={16} /> {t('marketplace:checkout.issues.heading')}
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {issues.map((issue, i) => {
              const item = findCartItem(issue.listingId);
              return (
                <li key={i}>
                  {t(ISSUE_MESSAGE_KEY[issue.reason] || 'marketplace:checkout.issues.generic', {
                    name: item?.name || t('marketplace:checkout.issues.anItem'),
                    count: issue.availableQty,
                    price: issue.newPriceCents != null ? formatLKR(issue.newPriceCents / 100) : '',
                  })}
                </li>
              );
            })}
          </ul>
          <Link to="/cart" style={{ display: 'inline-block', marginTop: '10px', fontSize: '12.5px', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {t('marketplace:checkout.issues.reviewCart')}
          </Link>
        </div>
      )}

      {step === 'address' && (
        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} /> {t('marketplace:checkout.deliverTo')}
          </h2>

          {!addresses ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('common:loading')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {addresses.map((a) => (
                <label
                  key={a._id}
                  className="glass-card"
                  style={{
                    padding: '14px 16px', borderRadius: '14px', display: 'flex', gap: '10px', cursor: 'pointer',
                    border: selectedAddressId === a._id ? '2px solid var(--accent-primary)' : '1px solid var(--border-light)',
                  }}
                >
                  <input type="radio" name="address" checked={selectedAddressId === a._id} onChange={() => setSelectedAddressId(a._id)} style={{ marginTop: '3px', accentColor: 'var(--accent-primary)' }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>{a.label || t('account:addresses.untitled')}</span>
                      {a.isDefault && <span className="badge badge-green"><Star size={10} /> {t('account:addresses.default')}</span>}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.district}
                      {a.landmark ? ` (${a.landmark})` : ''}<br />{a.phone}
                    </div>
                  </div>
                </label>
              ))}
              {addresses.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('account:addresses.empty')}</p>}
            </div>
          )}

          {adding ? (
            <form onSubmit={submitNewAddress} className="glass-card" style={{ padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <input className="input-field" placeholder={t('account:addresses.label')} value={addrForm.label} onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))} />
              <input className="input-field" placeholder={t('account:addresses.line1')} required value={addrForm.line1} onChange={(e) => setAddrForm((f) => ({ ...f, line1: e.target.value }))} />
              <input className="input-field" placeholder={t('account:addresses.line2')} value={addrForm.line2} onChange={(e) => setAddrForm((f) => ({ ...f, line2: e.target.value }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input className="input-field" placeholder={t('account:addresses.city')} required value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} />
                <select className="select-field" required aria-label={t('account:addresses.selectDistrict')} value={addrForm.district} onChange={(e) => setAddrForm((f) => ({ ...f, district: e.target.value }))}>
                  <option value="">{t('account:addresses.selectDistrict')}</option>
                  {SRI_LANKA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <input className="input-field" placeholder={t('account:addresses.landmark')} value={addrForm.landmark} onChange={(e) => setAddrForm((f) => ({ ...f, landmark: e.target.value }))} />
              <input className="input-field" placeholder={t('account:addresses.phone')} required value={addrForm.phone} onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>{t('common:cancel')}</button>
                <button type="submit" className="btn-primary">{t('account:addresses.save')}</button>
              </div>
            </form>
          ) : (
            <button className="btn-secondary" style={{ marginBottom: '20px' }} onClick={() => setAdding(true)}>
              <Plus size={14} /> {t('account:addresses.addNew')}
            </button>
          )}

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }} disabled={previewLoading || !selectedAddressId} onClick={goToReview}>
            {previewLoading ? <Loader2 size={18} className="spin" /> : <>{t('marketplace:checkout.continueToReview')} <ChevronRight size={16} /></>}
          </button>
        </div>
      )}

      {step === 'review' && preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={16} /> {t('summary.heading')}
            </h2>
            {preview.sellerGroups.map((group) => (
              <div key={group.sellerId} style={{ marginBottom: '18px', paddingBottom: '18px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                  {t('marketplace:checkoutComingSoon.soldBy', { seller: group.sellerName })}
                </div>
                {group.items.map((item) => (
                  <div key={item.listingId} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{item.title?.en || ''} × {item.qty}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatLKR(item.lineTotalCents / 100)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Truck size={12} /> {t('marketplace:checkout.deliveryFee')} ({group.weightKg}kg)</span>
                  <span>{formatLKR(group.deliveryFeeCents / 100)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <span>{t('marketplace:checkout.codForThisSeller')}</span>
                  <span>{formatLKR(group.codAmountCents / 100)}</span>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('summary.total')}</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent-primary)' }}>{formatLKR(preview.grandTotalCents / 100)}</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>{t('payment.heading')}</h2>
            <div style={{ padding: '16px', borderRadius: '14px', border: '2px solid #10b981', background: 'rgba(16, 185, 129, 0.05)', marginBottom: '16px', maxWidth: '320px' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13.5px' }}>💵 {t('payment.cashOnDelivery')}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {t('marketplace:checkout.codAmountNote', { total: formatLKR(preview.grandTotalCents / 100) })}
              </div>
            </div>
            <textarea
              className="input-field" placeholder={t('marketplace:checkout.noteToSeller')} value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)} maxLength={500}
              style={{ width: '100%', minHeight: '60px', resize: 'vertical', borderRadius: '12px', marginBottom: '16px' }}
            />

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--accent-primary)' }} />
              <Trans
                i18nKey="checkout:summary.termsCheckbox"
                components={[
                  <Link key="0" to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />,
                  <Link key="2" to="/returns" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />,
                ]}
              />
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setStep('address')} style={{ flex: '0 0 auto' }}>
                <ArrowLeft size={14} /> {t('marketplace:checkout.backToAddress')}
              </button>
              <button
                className="btn-primary" onClick={handlePlaceOrder} disabled={placing}
                style={{ flex: 1, justifyContent: 'center', padding: '14px', fontWeight: 800, background: '#10b981' }}
              >
                {placing ? <Loader2 size={18} className="spin" /> : <><ShieldCheck size={18} /> {t('summary.placeOrder')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPageMarketplace() {
  const [onlineOrderingEnabled, setOnlineOrderingEnabled] = useState(null);

  useEffect(() => {
    getPublicSettings().then(({ data }) => setOnlineOrderingEnabled(data.onlineOrderingEnabled)).catch(() => setOnlineOrderingEnabled(false));
  }, []);

  if (onlineOrderingEnabled === null) {
    return <div style={{ textAlign: 'center', padding: '80px 24px' }}><Loader2 size={28} className="spin" color="var(--accent-primary)" /></div>;
  }
  return onlineOrderingEnabled ? <RealCheckout /> : <ComingSoonCheckout />;
}
