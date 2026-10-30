import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getMyMarketplaceOrder, createMyReturn } from '../../api/marketplaceServices';

const REASONS = ['wrong_item', 'damaged', 'not_as_described', 'missing_part', 'other'];
const MAX_PHOTOS = 5;

// Milestone 8 — "Report a problem" for one delivered parcel. The eligible
// quantities come from the server (describe returnability on the order
// detail), so the form only offers what the backend would accept.
export default function ReportProblemModal({ orderNumber, sellerOrderId, onClose, onSubmitted }) {
  const { t, i18n } = useTranslation('order');
  const [parcel, setParcel] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState('damaged');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMyMarketplaceOrder(orderNumber)
      .then(({ data }) => {
        const found = data.sellerOrders.find((so) => so._id === sellerOrderId);
        if (!found) setLoadError(true);
        setParcel(found || null);
      })
      .catch(() => setLoadError(true));
  }, [orderNumber, sellerOrderId]);

  const setQty = (itemId, value) => setQuantities((q) => ({ ...q, [itemId]: value }));

  const lines = Object.entries(quantities)
    .map(([itemId, qty]) => ({ itemId, qty: Number(qty) }))
    .filter((l) => l.qty > 0);

  const onPhotos = (e) => {
    const picked = Array.from(e.target.files || []).slice(0, MAX_PHOTOS);
    setPhotos(picked);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (lines.length === 0) return;
    const form = new FormData();
    form.append('sellerOrderId', sellerOrderId);
    form.append('reason', reason);
    form.append('customerNote', note.trim());
    form.append('lines', JSON.stringify(lines));
    photos.forEach((file) => form.append('photos', file));

    setSubmitting(true);
    try {
      await createMyReturn(form);
      toast.success(t('myReturns.submitted'));
      onSubmitted();
    } catch (err) {
      toast.error(err.response?.data?.message || t('myReturns.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const itemName = (item) => item.title?.[i18n.language] || item.title?.en || item.sku;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" role="dialog" aria-modal="true" style={{ maxWidth: '520px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>{t('myReturns.modalTitle')}</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>{t('myReturns.modalIntro')}</p>

        {!parcel && !loadError && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('myReturns.loading')}</div>}
        {loadError && <div style={{ color: '#ef4444', fontSize: '13px' }}>{t('myReturns.loadFailed')}</div>}

        {parcel && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              {t('myReturns.itemsHeading')}
            </div>
            {parcel.items.map((item) => {
              const info = parcel.returnability?.find((r) => r.itemId === String(item._id));
              const canRequest = !!info?.canRequest;
              return (
                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{itemName(item)}</div>
                    {canRequest && info.windowEndsAt && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {t('myReturns.windowEnds', { date: new Date(info.windowEndsAt).toLocaleDateString('en-LK', { dateStyle: 'medium' }) })}
                      </div>
                    )}
                    {!canRequest && info?.blockedReason && (
                      <div style={{ fontSize: '11.5px', color: '#ef4444' }}>{t(`myReturns.blocked.${info.blockedReason}`)}</div>
                    )}
                  </div>
                  {canRequest && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      {t('myReturns.qty')}
                      <select className="input-field" style={{ width: 'auto', padding: '6px 8px' }} value={quantities[String(item._id)] || 0} onChange={(e) => setQty(String(item._id), e.target.value)}>
                        {Array.from({ length: info.remainingQty + 1 }, (_, n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              );
            })}

            <label style={{ fontSize: '12px', fontWeight: 700 }}>
              {t('myReturns.reasonLabel')}
              <select className="input-field" style={{ width: '100%', marginTop: '6px' }} value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => <option key={r} value={r}>{t(`myReturns.reason.${r}`)}</option>)}
              </select>
            </label>

            <label style={{ fontSize: '12px', fontWeight: 700 }}>
              {t('myReturns.noteLabel')}
              <textarea className="input-field" rows={3} maxLength={1000} style={{ width: '100%', marginTop: '6px' }} placeholder={t('myReturns.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>

            <label style={{ fontSize: '12px', fontWeight: 700 }}>
              {t('myReturns.photosLabel')}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onPhotos} style={{ display: 'block', marginTop: '6px', fontSize: '12px' }} />
            </label>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '-8px' }}>
              {photos.length > 0 ? t('myReturns.photosChosen', { count: photos.length }) : t('myReturns.photosHint')}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>{t('myReturns.close')}</button>
              <button type="submit" className="btn-primary" disabled={submitting || lines.length === 0}>
                {submitting ? t('myReturns.submitting') : t('myReturns.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
