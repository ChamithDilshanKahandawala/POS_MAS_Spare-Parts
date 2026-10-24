import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, MapPin, MessageSquare, Truck, Printer, AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyOrderDetail, transitionMyOrder, markOrderPosRecorded, markOrderReturnPosRecorded } from '../../api/services';
import { formatLKR } from '../../utils/formatLKR';
import { formatDateTime } from '../../utils/formatDateTime';

const STATUS_BADGE = {
  new: 'badge-yellow', confirmed: 'badge-blue', packed: 'badge-blue',
  shipped: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red', delivery_failed: 'badge-red', returned: 'badge-red',
};

// Part G — wa.me needs E.164 without the leading '+'; a saved address
// phone is stored however the customer typed it (local "0771234567" or
// "+94771234567", per the zod regex on the storefront's address form),
// so this normalizes either shape to "94771234567" rather than assuming
// one.
function toWhatsappNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.startsWith('94') ? digits : `94${digits.replace(/^0/, '')}`;
}

// Milestone 6 Part E — order detail + every status action a seller can
// take, straight against controllers/sellerOrdersController.js's
// transition table (confirm/pack/ship/deliver/fail/cancel). Disallowed
// actions simply aren't rendered as buttons — the backend's own 409 is
// the real guard, this is just not offering a button that would fail.
export default function OrderDetailPage() {
  const { t } = useTranslation(['seller', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reasonModal, setReasonModal] = useState(null); // 'cancel' | 'fail' | null
  const [reason, setReason] = useState('');
  const [shipModal, setShipModal] = useState(false);
  const [courier, setCourier] = useState('Transexpress');
  const [trackingNumber, setTrackingNumber] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getMyOrderDetail(id).then(({ data: d }) => setData(d)).catch(() => toast.error(t('common:error.generic'))).finally(() => setLoading(false));
  }, [id, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const doTransition = async (body) => {
    setSubmitting(true);
    try {
      await transitionMyOrder(id, body);
      toast.success(t('orders.detail.updated'));
      setReasonModal(null); setReason(''); setShipModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePosRecorded = async () => {
    setSubmitting(true);
    try {
      await markOrderPosRecorded(id);
      toast.success(t('orders.detail.posRecordedDone'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  // Follow-up #5 — a SEPARATE checkbox from the sale's "Recorded in POS"
  // above: this one is for the RETURN, only ever relevant once the order
  // is actually 'returned'.
  const handleReturnPosRecorded = async () => {
    setSubmitting(true);
    try {
      await markOrderReturnPosRecorded(id);
      toast.success(t('orders.detail.returnPosRecordedDone'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!data) return null;
  const { order, posConnected } = data;

  const actions = [];
  if (order.status === 'new') actions.push({ key: 'confirm', label: t('orders.detail.actions.confirm'), className: 'btn-primary', onClick: () => doTransition({ action: 'confirm' }) });
  if (order.status === 'confirmed') actions.push({ key: 'pack', label: t('orders.detail.actions.pack'), className: 'btn-primary', onClick: () => doTransition({ action: 'pack' }) });
  if (order.status === 'packed') actions.push({ key: 'ship', label: t('orders.detail.actions.ship'), className: 'btn-primary', onClick: () => setShipModal(true) });
  if (order.status === 'shipped') {
    actions.push({ key: 'deliver', label: t('orders.detail.actions.deliver'), className: 'btn-primary', onClick: () => doTransition({ action: 'deliver' }) });
    actions.push({ key: 'fail', label: t('orders.detail.actions.fail'), className: 'btn-secondary', onClick: () => setReasonModal('fail') });
  }
  if (['new', 'confirmed', 'packed'].includes(order.status)) {
    actions.push({ key: 'cancel', label: t('orders.detail.actions.cancel'), className: 'btn-danger', onClick: () => setReasonModal('cancel') });
  }
  // Follow-up — the step after a failed/refused delivery.
  if (order.status === 'delivery_failed') {
    actions.push({ key: 'return', label: t('orders.detail.actions.return'), className: 'btn-primary', onClick: () => doTransition({ action: 'return' }) });
  }

  return (
    <div className="animate-fade">
      {/* Print packing slip (Part E) — everything else on the page is
          hidden for print; only #packing-slip (populated below, normally
          display:none on screen) becomes visible. */}
      <style>{'@media print { body * { visibility: hidden; } #packing-slip, #packing-slip * { visibility: visible; display: block !important; } #packing-slip { position: absolute; top: 0; left: 0; } }'}</style>
      <button className="btn-secondary" style={{ marginBottom: '16px' }} onClick={() => navigate('/seller/orders')}>
        <ArrowLeft size={14} /> {t('orders.detail.back')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>{order.orderNumber}</h1>
          <span className={`badge ${STATUS_BADGE[order.status]}`}>{t(`orders.tabs.${order.status}`)}</span>
        </div>
        <button className="btn-secondary" onClick={() => window.print()}><Printer size={14} /> {t('orders.detail.printPackingSlip')}</button>
      </div>

      {order.status === 'cancelled' && order.cancelReason && (
        <div className="glass-card" style={{ padding: '14px 18px', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--accent-red)', fontSize: '13px' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} /> {order.cancelReason}
        </div>
      )}

      {posConnected && !order.posRecorded && (
        <div className="glass-card" style={{ padding: '16px 18px', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '13px' }}>{t('orders.detail.posReminder')}</span>
          <button className="btn-secondary" disabled={submitting} onClick={handlePosRecorded}>
            <CheckCircle2 size={14} /> {t('orders.detail.posRecordedCheckbox')}
          </button>
        </div>
      )}
      {posConnected && order.posRecorded && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>✓ {t('orders.detail.posRecordedDone')}</div>
      )}

      {/* Follow-up #5 — a POS-linked seller never has marketplace stock
          touched on return (the POS owns that number), so this is its
          own actionable checkbox (returnPosRecorded), separate from the
          sale's "Recorded in POS" above — until it's checked, this order
          keeps showing up in the "not yet recorded in POS" reminder. */}
      {posConnected && order.status === 'returned' && !order.returnPosRecorded && (
        <div className="glass-card" style={{ padding: '16px 18px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '13px' }}>{t('orders.detail.posReturnReminder')}</span>
          <button className="btn-secondary" disabled={submitting} onClick={handleReturnPosRecorded}>
            <CheckCircle2 size={14} /> {t('orders.detail.returnPosRecordedCheckbox')}
          </button>
        </div>
      )}
      {posConnected && order.status === 'returned' && order.returnPosRecorded && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>✓ {t('orders.detail.returnPosRecordedDone')}</div>
      )}

      <div id="packing-slip" style={{ display: 'none' }}>
        <h2>{order.orderNumber}</h2>
        <p>{order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city}, {order.shippingAddress.district}</p>
        <p>{order.shippingAddress.phone}</p>
        <table>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i}><td>{item.title?.en}</td><td>× {item.qty}</td><td>{formatLKR(item.lineTotalCents)}</td></tr>
            ))}
          </tbody>
        </table>
        <p><strong>{t('orders.detail.codAmount')}: {formatLKR(order.codAmountCents)}</strong></p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.deliveryAddress')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', gap: '8px' }}><User size={13} color="var(--accent-primary)" /> {order.customer?.name || '—'}</div>
            <div style={{ display: 'flex', gap: '8px' }}><Phone size={13} color="var(--accent-primary)" /> {order.shippingAddress.phone}</div>
            <div style={{ display: 'flex', gap: '8px' }}><MapPin size={13} color="var(--accent-primary)" /> {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city}, {order.shippingAddress.district}</div>
            {order.customerNote && <div style={{ display: 'flex', gap: '8px' }}><MessageSquare size={13} color="var(--accent-primary)" /> {order.customerNote}</div>}
            {order.trackingNumber && <div style={{ display: 'flex', gap: '8px' }}><Truck size={13} color="var(--accent-primary)" /> {order.trackingNumber} ({order.courier})</div>}
          </div>
          <a
            href={`https://wa.me/${toWhatsappNumber(order.shippingAddress.phone)}?text=${encodeURIComponent(t('orders.detail.whatsappMessage', { orderNumber: order.orderNumber }))}`}
            target="_blank" rel="noopener noreferrer" className="btn-secondary"
            style={{ marginTop: '14px', display: 'inline-flex', textDecoration: 'none' }}
          >
            <MessageCircle size={14} /> {t('orders.detail.messageCustomer')}
          </a>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.items')}</h3>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span>{item.title?.en} × {item.qty} {item.weightEstimated && <span className="badge badge-orange" style={{ marginLeft: '6px' }}>{t('orders.detail.weightEstimated')}</span>}</span>
              <span style={{ fontWeight: 600 }}>{formatLKR(item.lineTotalCents)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('orders.detail.deliveryFee')}</span>
            <span>{formatLKR(order.deliveryFeeCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, paddingTop: '8px' }}>
            <span>{t('orders.detail.codAmount')}</span>
            <span style={{ color: 'var(--accent-primary)' }}>{formatLKR(order.codAmountCents)}</span>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '18px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.timeline')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {order.statusHistory.map((h, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {formatDateTime(h.at)} — <strong style={{ color: 'var(--text-primary)' }}>{t(`orders.tabs.${h.to}`)}</strong>
              {h.reason ? ` (${h.reason})` : ''}
            </div>
          ))}
        </div>
      </div>

      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {actions.map((a) => (
            <button key={a.key} className={a.className} disabled={submitting} onClick={a.onClick}>{a.label}</button>
          ))}
        </div>
      )}

      {reasonModal && (
        <div className="modal-overlay" onClick={() => setReasonModal(null)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t(`orders.detail.actions.${reasonModal}`)}</h3>
            <textarea
              className="input-field" style={{ width: '100%', minHeight: '80px' }}
              placeholder={t('orders.detail.reasonPlaceholder')} value={reason} onChange={(e) => setReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="btn-secondary" onClick={() => setReasonModal(null)}>{t('common:cancel')}</button>
              <button className="btn-danger" disabled={!reason.trim() || submitting} onClick={() => doTransition({ action: reasonModal, reason: reason.trim() })}>
                {t(`orders.detail.actions.${reasonModal}`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {shipModal && (
        <div className="modal-overlay" onClick={() => setShipModal(false)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.actions.ship')}</h3>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('orders.detail.courierLabel')}</label>
            <input className="input-field" style={{ width: '100%', marginBottom: '10px' }} value={courier} onChange={(e) => setCourier(e.target.value)} />
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('orders.detail.trackingLabel')}</label>
            <input className="input-field" style={{ width: '100%' }} value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="btn-secondary" onClick={() => setShipModal(false)}>{t('common:cancel')}</button>
              <button className="btn-primary" disabled={!courier.trim() || !trackingNumber.trim() || submitting} onClick={() => doTransition({ action: 'ship', courier: courier.trim(), trackingNumber: trackingNumber.trim() })}>
                {t('orders.detail.actions.ship')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
