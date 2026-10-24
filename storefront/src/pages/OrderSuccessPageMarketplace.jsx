import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import {
  CheckCircle2, Copy, Check, Truck, MapPin, Phone, MessageCircle,
  Package, AlertTriangle, XCircle, Store,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMyMarketplaceOrder } from '../api/marketplaceServices';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { formatLKR } from '../utils/formatLKR';
import { PLATFORM_INFO } from '../config/store';

const DEFAULT_TITLE = `${PLATFORM_INFO.name} | Vehicle Parts Marketplace in Sri Lanka`;
const STATUS_STEPS = ['new', 'confirmed', 'packed', 'shipped', 'delivered'];

function SkeletonBlock({ height }) {
  return (
    <div style={{
      height, borderRadius: '14px', background: 'var(--bg-card)',
      backgroundImage: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
    }} />
  );
}

// Milestone 6 Part C — one order can span several sellers, each with its
// own parcel (SellerOrder), own status, own COD amount. Unlike pos mode's
// single 4-step timeline, each parcel gets its own small status card
// here.
function SellerParcelCard({ sellerOrder, t }) {
  const isTerminal = sellerOrder.status === 'cancelled' || sellerOrder.status === 'delivery_failed';
  const stepIndex = STATUS_STEPS.indexOf(sellerOrder.status);

  return (
    <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Store size={15} color="var(--accent-primary)" />
          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>{sellerOrder.seller?.displayName || sellerOrder.seller?.name}</span>
        </div>
        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{sellerOrder.orderNumber}</span>
      </div>

      {isTerminal ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-red)', fontWeight: 700, fontSize: '13px', marginBottom: '14px' }}>
          <XCircle size={18} /> {t(`order:marketplaceStatus.${sellerOrder.status}`)}
          {sellerOrder.cancelReason && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {sellerOrder.cancelReason}</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '14px' }}>
          {STATUS_STEPS.map((step, i) => {
            const done = i <= stepIndex;
            const isLast = i === STATUS_STEPS.length - 1;
            return (
              <div key={step} style={{ display: 'flex', flex: 1, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '56px', maxWidth: '56px' }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-secondary)',
                    border: done ? 'none' : '1px solid var(--border-light)', color: done ? 'white' : 'var(--text-muted)', fontSize: '10px', fontWeight: 800,
                  }}>
                    {done ? <Check size={11} /> : i + 1}
                  </div>
                  <span style={{ fontSize: '9.5px', fontWeight: 600, color: done ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                    {t(`order:marketplaceStatus.${step}`)}
                  </span>
                </div>
                {!isLast && <div style={{ flex: 1, height: '2px', marginTop: '10px', background: i < stepIndex ? 'var(--accent-primary)' : 'var(--border-light)' }} />}
              </div>
            );
          })}
        </div>
      )}

      {sellerOrder.trackingNumber && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          {t('order:list.tracking')} <strong style={{ fontFamily: 'monospace' }}>{sellerOrder.trackingNumber}</strong>
          {sellerOrder.courier ? ` (${sellerOrder.courier})` : ''}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {sellerOrder.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
            <span style={{ color: 'var(--text-primary)' }}>{item.title?.en} × {item.qty}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatLKR(item.lineTotalCents / 100)}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-muted)' }}>{t('order:marketplaceItems.delivery')}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatLKR(sellerOrder.deliveryFeeCents / 100)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t('order:marketplaceItems.codAmount')}</span>
        <span style={{ fontWeight: 900, color: 'var(--accent-primary)' }}>{formatLKR(sellerOrder.codAmountCents / 100)}</span>
      </div>
    </div>
  );
}

export default function OrderSuccessPageMarketplace() {
  const { t } = useTranslation(['order', 'platform', 'marketplace']);
  const { id: orderNumber } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [copied, setCopied] = useState(false);

  const stateOrder = location.state?.order;
  const stateSellerOrders = location.state?.sellerOrders;
  const initial = stateOrder && stateOrder.orderNumber === orderNumber ? { order: stateOrder, sellerOrders: stateSellerOrders || [] } : null;

  const [data, setData] = useState(initial);
  const [loadStatus, setLoadStatus] = useState(initial ? 'ready' : 'loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (initial) return;
    let active = true;
    getMyMarketplaceOrder(orderNumber)
      .then(({ data: res }) => { if (active) { setData(res); setLoadStatus('ready'); } })
      .catch((err) => { if (active) setLoadStatus(err.response?.status === 404 ? 'notfound' : 'error'); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, retryKey]);

  useEffect(() => { window.scrollTo(0, 0); }, [orderNumber]);

  useEffect(() => {
    if (!data) return;
    document.title = `Order ${data.order.orderNumber} | ${PLATFORM_INFO.name}`;
    return () => { document.title = DEFAULT_TITLE; };
  }, [data]);

  if (loadStatus === 'loading') {
    return (
      <div className="animate-fade" style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SkeletonBlock height={160} /><SkeletonBlock height={200} /><SkeletonBlock height={160} />
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

  const { order, sellerOrders } = data;
  const whatsappHref = PLATFORM_INFO.supportWhatsapp
    ? `https://wa.me/${PLATFORM_INFO.supportWhatsapp}?text=${encodeURIComponent(t('whatsapp.marketplaceMessage', { orderNumber: order.orderNumber }))}`
    : null;

  const copyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      toast.success(t('invoice.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('invoice.copyFailed'));
    }
  };

  return (
    <div className="animate-fade" style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <motion.div
          initial={reducedMotion ? false : { scale: 0 }} animate={{ scale: 1 }}
          transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18 }}
          style={{ width: '76px', height: '76px', borderRadius: '999px', margin: '0 auto 16px', background: 'rgba(39,174,96,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <CheckCircle2 size={44} color="#27ae60" />
        </motion.div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '6px' }}>{t('headline')}</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{t('marketplaceSubheadline', { count: sellerOrders.length })}</p>
      </div>

      <div className="glass-card" style={{ padding: '18px 24px', borderRadius: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('invoice.label')}</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{order.orderNumber}</div>
        </div>
        <button onClick={copyOrderNumber} className="btn-secondary" style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t('invoice.copied') : t('invoice.copy')}
        </button>
      </div>

      <div className="glass-card" style={{ padding: '18px 24px', borderRadius: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          <MapPin size={14} color="var(--accent-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
          {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city}, {order.shippingAddress.district}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <Phone size={14} color="var(--accent-primary)" /> {order.shippingAddress.phone}
        </div>
      </div>

      <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>{t('marketplaceItems.parcelsHeading', { count: sellerOrders.length })}</h2>
      {sellerOrders.map((so) => <SellerParcelCard key={so._id} sellerOrder={so} t={t} />)}

      <div className="glass-card" style={{ padding: '18px 24px', borderRadius: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t('items.total')}</span>
        <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--accent-primary)' }}>{formatLKR(order.grandTotalCents / 100)}</span>
      </div>

      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '13px', borderRadius: '999px', marginBottom: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageCircle size={16} /> {t('whatsapp.cta')}
        </a>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Link to="/" className="btn-primary" style={{ flex: '1 1 160px', justifyContent: 'center', padding: '13px', textDecoration: 'none' }}>{t('actions.continueShopping')}</Link>
        <Link to="/orders" className="btn-secondary" style={{ flex: '1 1 160px', justifyContent: 'center', padding: '13px', textDecoration: 'none' }}>{t('actions.viewOrders')}</Link>
      </div>
    </div>
  );
}
