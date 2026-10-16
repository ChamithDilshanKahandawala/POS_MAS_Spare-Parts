import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Ban, RotateCcw, ShieldAlert, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getListingReviewDetail, approveListing, rejectListing, suspendListing, reinstateListing } from '../../api/services';
import { localized } from '../../utils/localized';
import MediaImage from '../../components/MediaImage';

const REJECTION_REASONS = ['photo_mismatch', 'missing_registration', 'price_wrong', 'prohibited_item', 'poor_photos', 'wrong_category', 'contact_in_text', 'other'];

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 600 }}>{value ?? '—'}</div>
    </div>
  );
}

function DiffValue({ value, lang }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  if (typeof value === 'object' && (value.en !== undefined || value.si !== undefined)) return <span>{localized(value, lang)}</span>;
  if (Array.isArray(value)) return <span>{value.length} item(s)</span>;
  if (typeof value === 'object') return <span>{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}

export default function ListingReviewDetailPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [note, setNote] = useState('');
  const [suspending, setSuspending] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getListingReviewDetail(id).then(({ data: d }) => setData(d)).catch(() => toast.error(t('common:error.generic'))).finally(() => setLoading(false));
  }, [id, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await approveListing(id);
      toast.success(t('listingReview.detail.approved'));
      navigate('/admin/listing-review');
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReject = async () => {
    if (reasons.length === 0) return;
    setSubmitting(true);
    try {
      await rejectListing(id, reasons, note);
      toast.success(t('listingReview.detail.rejected'));
      navigate('/admin/listing-review');
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitSuspend = async () => {
    if (!suspendReason.trim()) return;
    setSubmitting(true);
    try {
      await suspendListing(id, suspendReason.trim());
      toast.success(t('listingReview.detail.suspended'));
      setSuspending(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReinstate = async (to) => {
    setSubmitting(true);
    try {
      await reinstateListing(id, to);
      toast.success(t('listingReview.detail.reinstated'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReason = (r) => setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  if (loading) return <div>{t('common:loading')}</div>;
  if (!data) return <div>{t('common:error.generic')}</div>;

  const { listing, customerView, isRevision, revisionDiff, seller } = data;
  const canDecide = listing.status === 'in_review' || isRevision;

  return (
    <div className="animate-fade">
      <button className="btn-secondary" style={{ marginBottom: '16px', padding: '6px 12px', fontSize: '12px' }} onClick={() => navigate('/admin/listing-review')}>
        <ArrowLeft size={14} /> {t('listingReview.detail.back')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{customerView.title?.en}</h1>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <span className="badge badge-blue">{t(`products.status.${listing.status}`)}</span>
            {isRevision && <span className="badge badge-yellow">{t('listingReview.filters.revision')}</span>}
            {seller.onProbation && <span className="badge badge-orange"><Clock size={10} /> {t('listingReview.detail.onProbation')}</span>}
            {seller.reviewExempt && <span className="badge badge-green">{t('listingReview.detail.reviewExempt')}</span>}
          </div>
        </div>
        {['published', 'hidden'].includes(listing.status) && !isRevision && (
          <button className="btn-danger" onClick={() => setSuspending(true)}><Ban size={14} /> {t('listingReview.detail.suspend')}</button>
        )}
        {listing.status === 'suspended' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" disabled={submitting} onClick={() => handleReinstate('hidden')}>{t('listingReview.detail.reinstateHidden')}</button>
            <button className="btn-primary" disabled={submitting} onClick={() => handleReinstate('published')}><RotateCcw size={14} /> {t('listingReview.detail.reinstatePublished')}</button>
          </div>
        )}
      </div>

      <div className="sidebar-detail-layout">
        <div>
          <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px', background: 'var(--bg-secondary)' }}>
              {customerView.images?.[0] && <MediaImage mediaId={customerView.images[0]} size="medium" scope="admin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {customerView.images?.slice(1).map((imgId) => (
                <MediaImage key={imgId} mediaId={imgId} size="thumb" scope="admin" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
              ))}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-primary-text)', marginBottom: '6px' }}>Rs {(customerView.priceCents / 100).toLocaleString()}</div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{customerView.description?.en}</p>
          </div>

          <div className="glass-card" style={{ padding: '14px', marginTop: '16px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>{t('listingReview.detail.sellerInfo')}</h4>
            <Field label={t('listingReview.detail.sellerName')} value={seller.name} />
            <div style={{ marginTop: '8px' }}><Field label={t('listingReview.detail.everPublished')} value={seller.everPublished} /></div>
          </div>
        </div>

        <div>
          {isRevision && revisionDiff && (
            <div className="glass-card" style={{ padding: '18px', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('listingReview.detail.diffTitle')}</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('listingReview.detail.diffField')}</th>
                    <th>{t('listingReview.detail.diffLive')}</th>
                    <th>{t('listingReview.detail.diffProposed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(revisionDiff).map(([key, { from, to }]) => (
                    <tr key={key}>
                      <td style={{ fontWeight: 600 }}>{key}</td>
                      <td><DiffValue value={from} lang={i18n.language} /></td>
                      <td><DiffValue value={to} lang={i18n.language} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="glass-card" style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '16px' }}>
            <Field label={t('listingReview.detail.brand')} value={listing.brand} />
            <Field label={t('listingReview.detail.condition')} value={listing.condition} />
            <Field label={t('listingReview.detail.sku')} value={listing.sku} />
            <Field label={t('listingReview.detail.stock')} value={listing.stock} />
            {listing.regulated && <Field label={t('listingReview.detail.regulated')} value={<ShieldAlert size={14} />} />}
          </div>

          {canDecide && (
            <div className="glass-card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <button className="btn-primary" disabled={submitting} onClick={handleApprove}><Check size={14} /> {t('listingReview.detail.approve')}</button>
                <button className="btn-danger" disabled={submitting} onClick={() => setRejecting(true)}><X size={14} /> {t('listingReview.detail.reject')}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {rejecting && (
        <div className="modal-overlay" onClick={() => setRejecting(false)}>
          <div className="modal-box" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('listingReview.detail.reject')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {REJECTION_REASONS.map((r) => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input type="checkbox" checked={reasons.includes(r)} onChange={() => toggleReason(r)} />
                  {t(`listingReview.detail.reasons.${r}`)}
                </label>
              ))}
            </div>
            <textarea className="input-field" style={{ width: '100%', minHeight: '70px', marginBottom: '16px' }} placeholder={t('listingReview.detail.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setRejecting(false)}>{t('common:cancel')}</button>
              <button className="btn-danger" disabled={reasons.length === 0 || submitting} onClick={submitReject}>{t('listingReview.detail.reject')}</button>
            </div>
          </div>
        </div>
      )}

      {suspending && (
        <div className="modal-overlay" onClick={() => setSuspending(false)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('listingReview.detail.suspend')}</h3>
            <textarea className="input-field" style={{ width: '100%', minHeight: '70px', marginBottom: '16px' }} placeholder={t('listingReview.detail.reasonPlaceholder')} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setSuspending(false)}>{t('common:cancel')}</button>
              <button className="btn-danger" disabled={!suspendReason.trim() || submitting} onClick={submitSuspend}>{t('listingReview.detail.suspend')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
