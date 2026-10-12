import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
// `motion` is used via the <motion.div> member expression below; see the
// same eslint note as CartDrawer.jsx.
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import {
  CheckCircle2, Copy, Check, Truck, MapPin, Phone, User,
  MessageCircle, Package, AlertTriangle, XCircle,
} from 'lucide-react';
import { getMyOrderById } from '../api/services';
import ProductImage from '../components/product/ProductImage';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { useTranslation } from 'react-i18next';
import { formatLKR } from '../utils/formatLKR';
import { SHOP_INFO, getDeliveryEstimate } from '../config/store';

const DEFAULT_TITLE = `${SHOP_INFO.name} · Genuine Vehicle Spare Parts`;

// order_status enum, from backend/models/Sale.js: Pending/Processing/
// Shipped/Delivered map onto the 4-step happy path; Cancelled/Returned are
// terminal/exception states shown as a banner instead (see render below).
const STATUS_TO_STEP_INDEX = { Pending: 0, Processing: 1, Shipped: 2, Delivered: 3 };

// "address, city, district" — CheckoutPage builds shipping_address this way
// and there's no separate stored district field (see Step 0 finding #2),
// so this is a best-effort parse back out, not a guaranteed-accurate one.
function parseAddress(shippingAddress) {
  const parts = (shippingAddress || '').split(',').map((s) => s.trim()).filter(Boolean);
  const district = parts.length ? parts[parts.length - 1] : '';
  const rest = parts.length > 1 ? parts.slice(0, -1).join(', ') : shippingAddress || '';
  return { district, rest };
}

function SkeletonBlock({ height }) {
  return (
    <div style={{
      height, borderRadius: '14px', background: 'var(--bg-card)',
      backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  );
}

export default function OrderSuccessPage() {
  const { t } = useTranslation('order');
  const STATUS_STEPS = [
    { key: 'placed', label: t('timeline.placed') },
    { key: 'confirmed', label: t('timeline.confirmed') },
    { key: 'dispatched', label: t('timeline.dispatched') },
    { key: 'delivered', label: t('timeline.delivered') },
  ];
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [copied, setCopied] = useState(false);

  // Instant render when we arrived here straight from a successful
  // checkout (see CheckoutPage) — the fetch below only runs when that
  // state is missing (direct load, refresh, or a shared link).
  const stateSale = location.state?.sale;
  const initialOrder = stateSale && stateSale._id === id ? stateSale : null;

  const [order, setOrder] = useState(initialOrder);
  const [loadStatus, setLoadStatus] = useState(initialOrder ? 'ready' : 'loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    // `initialOrder` intentionally isn't a dependency — it's only relevant
    // at mount (this page is remounted fresh per :id, see App.jsx), and
    // listing it would just make this effect re-run pointlessly once
    // setOrder below updates it anyway.
    if (initialOrder) return;
    let active = true;
    getMyOrderById(id)
      .then(({ data }) => { if (active) { setOrder(data); setLoadStatus('ready'); } })
      .catch((err) => {
        if (!active) return;
        setLoadStatus(err.response?.status === 404 ? 'notfound' : 'error');
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retryKey]);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  useEffect(() => {
    if (!order) return;
    document.title = `Order ${order.invoice_number} | ${SHOP_INFO.name}`;
    return () => { document.title = DEFAULT_TITLE; };
  }, [order]);

  if (loadStatus === 'loading') {
    return (
      <div className="animate-fade" style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SkeletonBlock height={160} />
        <SkeletonBlock height={80} />
        <SkeletonBlock height={200} />
        <SkeletonBlock height={160} />
      </div>
    );
  }

  if (loadStatus === 'notfound') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Package size={36} style={{ opacity: 0.35, color: 'var(--text-muted)' }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>{t('notFound.title')}</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('notFound.subtitle')}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>{t('actions.backToShop')}</button>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertTriangle size={36} style={{ opacity: 0.35, color: 'var(--accent-red)' }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>{t('error.title')}</p>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('error.subtitle')}</p>
        <button className="btn-primary" onClick={() => { setLoadStatus('loading'); setRetryKey((k) => k + 1); }}>{t('actions.tryAgain')}</button>
      </div>
    );
  }

  const { district, rest: addressLine } = parseAddress(order.shipping_address);
  const deliveryEstimate = getDeliveryEstimate(district);
  const isTerminal = order.order_status === 'Cancelled' || order.order_status === 'Returned';
  const currentStep = STATUS_TO_STEP_INDEX[order.order_status] ?? 0;
  const deliveryFee = order.shipping_cost_charged || 0;

  const whatsappHref = SHOP_INFO.whatsapp
    ? `https://wa.me/${SHOP_INFO.whatsapp}?text=${encodeURIComponent(t('whatsapp.message', { invoiceNumber: order.invoice_number, total: formatLKR(order.total_amount) }))}`
    : null;

  const copyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(order.invoice_number);
      setCopied(true);
      toast.success(t('invoice.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('invoice.copyFailed'));
    }
  };

  return (
    <div className="animate-fade" style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Success check */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <motion.div
          initial={reducedMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18 }}
          style={{
            width: '76px', height: '76px', borderRadius: '999px', margin: '0 auto 16px',
            background: 'rgba(39,174,96,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <CheckCircle2 size={44} color="#27ae60" />
        </motion.div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '6px' }}>{t('headline')}</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{t('subheadline')}</p>
      </div>

      {/* Invoice number */}
      <div className="glass-card" style={{ padding: '18px 24px', borderRadius: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('invoice.label')}</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{order.invoice_number}</div>
        </div>
        <button
          onClick={copyInvoice}
          className="btn-secondary"
          style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t('invoice.copied') : t('invoice.copy')}
        </button>
      </div>

      {/* Status timeline */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
        {isTerminal ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-red)', fontWeight: 700, fontSize: '14px' }}>
            <XCircle size={20} />
            {order.order_status === 'Cancelled' ? t('timeline.cancelled') : t('timeline.returned')}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentStep;
              const isLast = i === STATUS_STEPS.length - 1;
              return (
                <div key={step.key} style={{ display: 'flex', flex: isLast ? '0 0 auto' : 1, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '64px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-secondary)',
                      border: done ? 'none' : '1px solid var(--border-light)',
                      color: done ? 'white' : 'var(--text-muted)', fontSize: '12px', fontWeight: 800,
                    }}>
                      {done ? <Check size={14} /> : i + 1}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: done ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>{step.label}</span>
                  </div>
                  {!isLast && (
                    <div style={{ flex: 1, height: '2px', marginTop: '13px', background: i < currentStep ? 'var(--accent-primary)' : 'var(--border-light)' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delivery details */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>{t('delivery.title')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={14} color="var(--accent-primary)" /> {order.customer_name}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}><MapPin size={14} color="var(--accent-primary)" style={{ marginTop: '2px', flexShrink: 0 }} /> {addressLine}{district ? `, ${district}` : ''}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={14} color="var(--accent-primary)" /> {order.customer_phone}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <Truck size={14} color="var(--accent-primary)" /> {t('delivery.estimate', { range: deliveryEstimate })}
          </div>
        </div>
      </div>

      {/* Items + totals */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>{t('items.title')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
          {order.items.map((item) => (
            <div key={item.product || item.product_name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ProductImage product={{ name: item.product_name }} size={48} style={{ borderRadius: '10px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('items.qtyLine', { count: item.quantity, price: formatLKR(item.selling_price) })}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatLKR(item.line_total)}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('items.subtotal')}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatLKR(order.subtotal)}</span>
          </div>
          {deliveryFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('items.deliveryFee')}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatLKR(deliveryFee)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', marginTop: '4px' }}>
            <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t('items.total')}</span>
            <span style={{ fontWeight: 900, color: 'var(--accent-primary)' }}>{formatLKR(order.total_amount)}</span>
          </div>
        </div>
        {order.payment_method === 'Cash' && (
          <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            💵 {t('payment.cod', { amount: formatLKR(order.total_amount) })}
          </div>
        )}
      </div>

      {whatsappHref && (
        <a
          href={whatsappHref} target="_blank" rel="noopener noreferrer"
          className="btn-secondary"
          style={{ width: '100%', justifyContent: 'center', padding: '13px', borderRadius: '999px', marginBottom: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <MessageCircle size={16} /> {t('whatsapp.cta')}
        </a>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Link to="/" className="btn-primary" style={{ flex: '1 1 160px', justifyContent: 'center', padding: '13px', textDecoration: 'none' }}>
          {t('actions.continueShopping')}
        </Link>
        <Link to="/orders" className="btn-secondary" style={{ flex: '1 1 160px', justifyContent: 'center', padding: '13px', textDecoration: 'none' }}>
          {t('actions.viewOrders')}
        </Link>
      </div>
    </div>
  );
}
