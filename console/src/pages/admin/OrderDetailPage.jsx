import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, MapPin, Store, FastForward, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminOrderDetail, cancelAdminOrder, moveAdminOrderOn, addAdminOrderNote } from '../../api/services';
import { formatLKR } from '../../utils/formatLKR';
import { formatDateTime } from '../../utils/formatDateTime';

const STATUS_BADGE = {
  new: 'badge-yellow', confirmed: 'badge-blue', packed: 'badge-blue',
  shipped: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red', delivery_failed: 'badge-red', returned: 'badge-red',
};
const FORWARD_ORDER = ['new', 'confirmed', 'packed', 'shipped', 'delivered'];

// Milestone 6 Part F — admin's own order detail: every parcel, full
// contact info (unlike the seller view, nothing here is ever masked —
// this is the platform's own oversight tool), internal notes, cancel and
// "move a stuck parcel on" (both audited server-side).
export default function OrderDetailPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [moveOnModal, setMoveOnModal] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getAdminOrderDetail(id).then(({ data }) => setOrder(data.order)).catch(() => toast.error(t('common:error.generic'))).finally(() => setLoading(false));
  }, [id, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const submitCancel = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await cancelAdminOrder(id, reason.trim());
      toast.success(t('orders.detail.cancelled'));
      setCancelModal(false); setReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitMoveOn = async (toStatus) => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await moveAdminOrderOn(id, toStatus, reason.trim());
      toast.success(t('orders.detail.moved'));
      setMoveOnModal(false); setReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitNote = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await addAdminOrderNote(id, note.trim());
      setNote('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!order) return null;

  const canCancel = ['new', 'confirmed', 'packed'].includes(order.status);
  const forwardOptions = FORWARD_ORDER.filter((s) => FORWARD_ORDER.indexOf(s) > FORWARD_ORDER.indexOf(order.status));

  return (
    <div className="animate-fade">
      <button className="btn-secondary" style={{ marginBottom: '16px' }} onClick={() => navigate('/admin/orders')}>
        <ArrowLeft size={14} /> {t('orders.detail.back')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>{order.orderNumber}</h1>
          <span className={`badge ${STATUS_BADGE[order.status]}`}>{t(`orders.tabs.${order.status}`)}</span>
          {order.refundNeeded && <span className="badge badge-red" style={{ marginLeft: '6px' }}>{t('orders.refundNeededBadge')}</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {forwardOptions.length > 0 && !['cancelled', 'delivery_failed', 'returned'].includes(order.status) && (
            <button className="btn-secondary" onClick={() => setMoveOnModal(true)}><FastForward size={14} /> {t('orders.detail.moveOn')}</button>
          )}
          {canCancel && <button className="btn-danger" onClick={() => setCancelModal(true)}>{t('orders.detail.actions.cancel')}</button>}
        </div>
      </div>

      {order.refundNeeded && (
        <div className="glass-card" style={{ padding: '16px 18px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <Banknote size={16} color="#ef4444" /> {t('orders.detail.refundNeededBanner')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.deliveryAddress')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', gap: '8px' }}><Store size={13} color="var(--accent-primary)" /> {order.seller?.displayName || order.seller?.name}</div>
            <div style={{ display: 'flex', gap: '8px' }}><User size={13} color="var(--accent-primary)" /> {order.customer?.name} ({order.customer?.email})</div>
            <div style={{ display: 'flex', gap: '8px' }}><Phone size={13} color="var(--accent-primary)" /> {order.shippingAddress.phone}</div>
            <div style={{ display: 'flex', gap: '8px' }}><MapPin size={13} color="var(--accent-primary)" /> {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city}, {order.shippingAddress.district}</div>
            {order.trackingNumber && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{order.courier}: {order.trackingNumber}</div>}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.items')}</h3>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span>{item.title?.en} × {item.qty}</span>
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
          {order.refusedParcelCostCents > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingTop: '8px', color: 'var(--text-muted)' }}>
              <span>{t('orders.detail.refusedParcelCost')}</span>
              <span>{formatLKR(order.refusedParcelCostCents)}</span>
            </div>
          )}
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

      <div className="glass-card" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.internalNotes')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {(order.internalNotes || []).map((n, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              {n.text} <span style={{ color: 'var(--text-muted)' }}>— {formatDateTime(n.at)}</span>
            </div>
          ))}
          {(!order.internalNotes || order.internalNotes.length === 0) && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('orders.detail.noNotes')}</div>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input className="input-field" style={{ flex: 1 }} placeholder={t('orders.detail.addNotePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-secondary" disabled={!note.trim() || submitting} onClick={submitNote}>{t('orders.detail.addNote')}</button>
        </div>
      </div>

      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(false)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.actions.cancel')}</h3>
            <textarea className="input-field" style={{ width: '100%', minHeight: '80px' }} placeholder={t('orders.detail.reasonPlaceholder')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="btn-secondary" onClick={() => setCancelModal(false)}>{t('common:cancel')}</button>
              <button className="btn-danger" disabled={!reason.trim() || submitting} onClick={submitCancel}>{t('orders.detail.actions.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {moveOnModal && (
        <div className="modal-overlay" onClick={() => setMoveOnModal(false)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('orders.detail.moveOn')}</h3>
            <textarea className="input-field" style={{ width: '100%', minHeight: '80px', marginBottom: '12px' }} placeholder={t('orders.detail.reasonPlaceholder')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {forwardOptions.map((s) => (
                <button key={s} className="btn-primary" disabled={!reason.trim() || submitting} onClick={() => submitMoveOn(s)}>
                  {t(`orders.tabs.${s}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
