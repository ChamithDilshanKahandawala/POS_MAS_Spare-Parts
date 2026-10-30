import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSellerReturn, respondToSellerReturn, markSellerReturnReceived, getSellerReturnPhotoBlob } from '../../api/services';
import { formatDateTime } from '../../utils/formatDateTime';
import EmptyState from '../../components/EmptyState';
import { ReturnStatusBadge, ReturnLines, ReturnPhotos, ReturnTimeline } from '../../components/returns/ReturnParts';
import { formatLKR } from '../../utils/formatLKR';

// Seller response to one return: accept or reject it (with a reason), and
// confirm when the physical item has come back.
export default function ReturnDetailPage() {
  const { t } = useTranslation(['seller', 'common']);
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getSellerReturn(id)
      .then(({ data: d }) => setData(d.returnRequest))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const fetchPhoto = useCallback((index) => getSellerReturnPhotoBlob(id, index), [id]);

  const run = async (action, successKey) => {
    setSubmitting(true);
    try {
      await action();
      toast.success(t(successKey));
      setRejecting(false);
      setNote('');
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
  const awaitingPlatform = r.status === 'seller_rejected' || r.status === 'escalated';
  const awaitingReturn = r.status === 'seller_accepted' || r.status === 'admin_decided';

  return (
    <div className="animate-fade">
      <Link to="/seller/returns" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <ArrowLeft size={14} /> {t('returnsPage.detail.back')}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{r.requestNumber}</h1>
        <ReturnStatusBadge status={r.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px' }}><strong>{t('common:returns.fields.order')}:</strong> <span style={{ fontFamily: 'monospace' }}>{r.orderNumber}</span></div>
            <div style={{ fontSize: '13px' }}><strong>{t('common:returns.fields.reason')}:</strong> {t(`common:returns.reason.${r.reason}`)}</div>
            {r.customerNote && <div style={{ fontSize: '13px' }}><strong>{t('common:returns.fields.note')}:</strong> {r.customerNote}</div>}
            <ReturnLines lines={r.lines} />
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('common:returns.photos.title')}</h2>
            <ReturnPhotos count={r.photos.length} fetchPhoto={fetchPhoto} />
          </div>

          {r.status === 'refunded' && (
            <div className="glass-card" style={{ padding: '20px', fontSize: '13px' }}>
              <div>{t('returnsPage.detail.refunded', { amount: formatLKR(r.resolution.customerRefundCents), date: formatDateTime(r.resolution.refundedAt) })}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {r.status === 'requested' && (
              <>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {t('returnsPage.detail.respondBy', { date: formatDateTime(r.responseDeadlineAt) })}
                </div>
                <button className="btn-primary" disabled={submitting} onClick={() => run(() => respondToSellerReturn(id, { accept: true }), 'returnsPage.toast.accepted')}>
                  {t('returnsPage.detail.accept')}
                </button>
                {!rejecting ? (
                  <button className="btn-secondary" disabled={submitting} onClick={() => setRejecting(true)}>
                    {t('returnsPage.detail.reject')}
                  </button>
                ) : (
                  <>
                    <label style={{ fontSize: '12px', fontWeight: 700 }}>{t('returnsPage.detail.rejectReason')}</label>
                    <textarea className="input-field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('returnsPage.detail.rejectPlaceholder')} />
                    <button
                      className="btn-primary"
                      disabled={submitting || !note.trim()}
                      onClick={() => run(() => respondToSellerReturn(id, { accept: false, note: note.trim() }), 'returnsPage.toast.rejected')}
                    >
                      {t('returnsPage.detail.confirmReject')}
                    </button>
                  </>
                )}
              </>
            )}

            {awaitingReturn && (
              <>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{t('returnsPage.detail.awaitingItem')}</div>
                <button className="btn-primary" disabled={submitting} onClick={() => run(() => markSellerReturnReceived(id), 'returnsPage.toast.received')}>
                  {t('returnsPage.detail.markReceived')}
                </button>
              </>
            )}

            {awaitingPlatform && <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{t('returnsPage.detail.withPlatform')}</div>}

            {r.sellerNote && <div style={{ fontSize: '12.5px' }}><strong>{t('returnsPage.detail.yourNote')}:</strong> {r.sellerNote}</div>}
            {r.adminNote && <div style={{ fontSize: '12.5px' }}><strong>{t('returnsPage.detail.platformNote')}:</strong> {r.adminNote}</div>}
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>{t('common:returns.timeline.title')}</h2>
            <ReturnTimeline timeline={r.timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}
