import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminReturn, decideAdminReturn, refundAdminReturn, getAdminReturnPhotoBlob } from '../../api/services';
import { useAuth } from '../../context/useAuth';
import { formatDateTime } from '../../utils/formatDateTime';
import { formatLKR } from '../../utils/formatLKR';
import EmptyState from '../../components/EmptyState';
import AdminStepUpModal from '../../components/AdminStepUpModal';
import { ReturnStatusBadge, ReturnLines, ReturnPhotos, ReturnTimeline } from '../../components/returns/ReturnParts';

const PAYERS = ['platform', 'seller', 'customer'];
const METHODS = ['bank_transfer', 'cash'];

// Platform side of one return: decide a disputed return (uphold or dismiss),
// and — owner only, behind a fresh step-up — mark an item-returned return as
// refunded with its return-shipping decision.
export default function ReturnDetailPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { id } = useParams();
  const { isPlatformOwner } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState('uphold');
  const [decisionNote, setDecisionNote] = useState('');
  const [payer, setPayer] = useState('platform');
  const [shippingRupees, setShippingRupees] = useState('0');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getAdminReturn(id)
      .then(({ data: d }) => setData(d.returnRequest))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const fetchPhoto = useCallback((index) => getAdminReturnPhotoBlob(id, index), [id]);

  const submitDecision = async () => {
    setSubmitting(true);
    try {
      await decideAdminReturn(id, { decision, note: decisionNote.trim() });
      toast.success(t('returnsPage.toast.decided'));
      setDecisionNote('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRefund = async () => {
    setSubmitting(true);
    try {
      await refundAdminReturn(id, {
        payer,
        shippingCents: Math.round(Number(shippingRupees || 0) * 100),
        method,
        reference: reference.trim(),
      });
      toast.success(t('returnsPage.toast.refunded'));
      setReference('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!data) return <EmptyState icon={RotateCcw} title={t('returnsPage.detail.notFound')} />;

  const r = data;
  const canDecide = r.status === 'seller_rejected' || r.status === 'escalated';
  const canRefund = r.status === 'item_returned';
  const refundAmountCents = r.refundItemsCents;

  return (
    <div className="animate-fade">
      <Link to="/admin/returns-disputes" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <ArrowLeft size={14} /> {t('returnsPage.detail.back')}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{r.requestNumber}</h1>
        <ReturnStatusBadge status={r.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px' }}><strong>{t('common:returns.fields.order')}:</strong> <span style={{ fontFamily: 'monospace' }}>{r.orderNumber}</span> · {r.seller?.name}</div>
            <div style={{ fontSize: '13px' }}><strong>{t('common:returns.fields.reason')}:</strong> {t(`common:returns.reason.${r.reason}`)}</div>
            {r.customerNote && <div style={{ fontSize: '13px' }}><strong>{t('common:returns.fields.note')}:</strong> {r.customerNote}</div>}
            <ReturnLines lines={r.lines} />
            {r.sellerNote && <div style={{ fontSize: '12.5px' }}><strong>{t('returnsPage.detail.sellerNote')}:</strong> {r.sellerNote}</div>}
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('common:returns.photos.title')}</h2>
            <ReturnPhotos count={r.photos.length} fetchPhoto={fetchPhoto} />
          </div>

          {r.status === 'refunded' && (
            <div className="glass-card" style={{ padding: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>{t('returnsPage.detail.resolution')}</strong></div>
              <div>{t('returnsPage.detail.customerRefund')}: {formatLKR(r.resolution.customerRefundCents)}</div>
              <div>{t('returnsPage.detail.returnShipping')}: {t(`common:returns.payer.${r.resolution.returnShippingPayer}`)} · {formatLKR(r.resolution.returnShippingCents)}</div>
              <div>{t(`common:returns.method.${r.resolution.refundMethod}`)} · {r.resolution.refundReference}</div>
              <div style={{ color: 'var(--text-muted)' }}>{formatDateTime(r.resolution.refundedAt)}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          {canDecide && (
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800 }}>{t('returnsPage.detail.decideTitle')}</h2>
              <label style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="radio" checked={decision === 'uphold'} onChange={() => setDecision('uphold')} /> {t('returnsPage.detail.uphold')}
              </label>
              <label style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="radio" checked={decision === 'dismiss'} onChange={() => setDecision('dismiss')} /> {t('returnsPage.detail.dismiss')}
              </label>
              <textarea className="input-field" rows={3} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder={t('returnsPage.detail.notePlaceholder')} />
              <button className="btn-primary" disabled={submitting || !decisionNote.trim()} onClick={submitDecision}>
                {t('returnsPage.detail.submitDecision')}
              </button>
            </div>
          )}

          {canRefund && (
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800 }}>{t('returnsPage.detail.refundTitle')}</h2>
              <div style={{ fontSize: '13px' }}>{t('returnsPage.detail.refundValue')}: <strong>{formatLKR(refundAmountCents)}</strong></div>
              {!isPlatformOwner ? (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{t('returnsPage.detail.ownerOnly')}</div>
              ) : (
                <>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>{t('returnsPage.detail.payer')}</div>
                  {PAYERS.map((p) => (
                    <label key={p} style={{ fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="radio" checked={payer === p} onChange={() => setPayer(p)} /> {t(`common:returns.payer.${p}`)}
                    </label>
                  ))}
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>{t('returnsPage.detail.shipping')}</label>
                  <input className="input-field" type="number" min="0" step="0.01" value={shippingRupees} onChange={(e) => setShippingRupees(e.target.value)} />
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>{t('returnsPage.detail.method')}</label>
                  <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {METHODS.map((m) => <option key={m} value={m}>{t(`common:returns.method.${m}`)}</option>)}
                  </select>
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>{t('returnsPage.detail.reference')}</label>
                  <input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('returnsPage.detail.referencePlaceholder')} />
                  <button className="btn-primary" disabled={submitting || !reference.trim()} onClick={() => setStepUpOpen(true)}>
                    {t('returnsPage.detail.confirmRefund')}
                  </button>
                </>
              )}
            </div>
          )}

          {r.adminNote && <div className="glass-card" style={{ padding: '20px', fontSize: '12.5px' }}><strong>{t('returnsPage.detail.platformNote')}:</strong> {r.adminNote}</div>}

          <div className="glass-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('common:returns.timeline.title')}</h2>
            <ReturnTimeline timeline={r.timeline} />
          </div>
        </div>
      </div>

      <AdminStepUpModal
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        title={t('returnsPage.detail.confirmRefund')}
        onConfirmed={() => {
          setStepUpOpen(false);
          submitRefund();
        }}
      />
    </div>
  );
}
