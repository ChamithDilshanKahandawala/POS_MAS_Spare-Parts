import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, ShieldCheck, X } from 'lucide-react';
import {
  getPayoutRun, removeSellerFromPayoutRun, approvePayoutRun, getPayoutRunExportCsvBlob, markPayoutPaid, markPayoutFailed,
} from '../../api/services';
import { formatLKR } from '../../utils/formatLKR';
import { formatDate } from '../../utils/formatDateTime';
import AdminStepUpModal from '../../components/AdminStepUpModal';

const STATUS_BADGE = { blocked: 'badge-red', settled_internally: 'badge-blue', in_payout: 'badge-yellow', paid: 'badge-green', failed: 'badge-red' };

// Milestone 7 Part C.3/C.4/C.5/C.6 — the review/approve/export/settle
// screen for one week's payout run.
export default function PayoutRunDetailPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stepUpFor, setStepUpFor] = useState(null); // 'approve' | 'export' | null
  const [markPaidFor, setMarkPaidFor] = useState(null);
  const [bankReference, setBankReference] = useState('');
  const [markFailedFor, setMarkFailedFor] = useState(null);
  const [failReason, setFailReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getPayoutRun(id).then(({ data }) => setReview(data)).catch(() => toast.error(t('common:error.generic'))).finally(() => setLoading(false));
  }, [id, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const removeSeller = async (sellerId) => {
    if (!window.confirm(t('finance.payoutRunDetail.confirmRemove'))) return;
    try {
      await removeSellerFromPayoutRun(id, sellerId);
      toast.success(t('finance.payoutRunDetail.removed'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const doApprove = async () => {
    try {
      await approvePayoutRun(id);
      toast.success(t('finance.payoutRunDetail.approved'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const doExport = async () => {
    try {
      const { data } = await getPayoutRunExportCsvBlob(id);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payout-${review.run.weekKey}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const submitMarkPaid = async () => {
    if (!bankReference.trim()) return;
    try {
      await markPayoutPaid(markPaidFor, bankReference.trim());
      toast.success(t('finance.payoutRunDetail.markedPaid'));
      setMarkPaidFor(null); setBankReference('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const submitMarkFailed = async () => {
    if (!failReason.trim()) return;
    try {
      await markPayoutFailed(markFailedFor, failReason.trim());
      toast.success(t('finance.payoutRunDetail.markedFailed'));
      setMarkFailedFor(null); setFailReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!review) return null;

  const { run, payouts } = review;
  const isDraft = run.status === 'draft';

  return (
    <div className="animate-fade">
      <button className="btn-secondary" style={{ marginBottom: '16px' }} onClick={() => navigate('/admin/finance')}>
        <ArrowLeft size={14} /> {t('finance.payoutRunDetail.back')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px' }}>{run.weekKey}</h1>
          <span className={`badge ${isDraft ? 'badge-yellow' : 'badge-green'}`}>{t(`finance.payoutRuns.status.${run.status}`)}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isDraft && (
            <button className="btn-primary" onClick={() => setStepUpFor('approve')}>
              <ShieldCheck size={14} /> {t('finance.payoutRunDetail.approve')}
            </button>
          )}
          {!isDraft && (
            <button className="btn-secondary" onClick={() => setStepUpFor('export')}>
              <Download size={14} /> {t('finance.payoutRunDetail.exportCsv')}
            </button>
          )}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('finance.payoutRunDetail.table.seller')}</th>
              <th>{t('finance.payoutRunDetail.table.gross')}</th>
              <th>{t('finance.payoutRunDetail.table.commission')}</th>
              <th>{t('finance.payoutRunDetail.table.charges')}</th>
              <th>{t('finance.payoutRunDetail.table.adjustments')}</th>
              <th>{t('finance.payoutRunDetail.table.net')}</th>
              <th>{t('finance.payoutRunDetail.table.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p._id}>
                <td>{p.seller?.displayName || p.seller?.name}</td>
                <td>{formatLKR(p.grossSalesCents)}</td>
                <td>{formatLKR(p.commissionCents)}</td>
                <td>{formatLKR(p.chargesCents)}</td>
                <td>{formatLKR(p.adjustmentsCents)}</td>
                <td style={{ fontWeight: 800 }}>{formatLKR(p.netCents)}</td>
                <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{t(`finance.payoutStatus.${p.status}`)}</span></td>
                <td style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  {isDraft && p.status !== 'blocked' && p.status !== 'settled_internally' && (
                    <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => removeSeller(p.seller?._id)}>
                      <X size={12} /> {t('finance.payoutRunDetail.remove')}
                    </button>
                  )}
                  {p.status === 'in_payout' && (
                    <>
                      <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setMarkPaidFor(p._id)}>{t('finance.payoutRunDetail.markPaid')}</button>
                      <button className="btn-danger" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setMarkFailedFor(p._id)}>{t('finance.payoutRunDetail.markFailed')}</button>
                    </>
                  )}
                  {p.status === 'paid' && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.paidReference}</span>}
                  {p.status === 'failed' && <span style={{ fontSize: '12px', color: 'var(--badge-red-text)' }}>{p.failedReason}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminStepUpModal
        open={!!stepUpFor}
        onClose={() => setStepUpFor(null)}
        title={stepUpFor === 'approve' ? t('finance.payoutRunDetail.approve') : t('finance.payoutRunDetail.exportCsv')}
        onConfirmed={() => {
          const action = stepUpFor;
          setStepUpFor(null);
          if (action === 'approve') doApprove(); else doExport();
        }}
      />

      {markPaidFor && (
        <div className="modal-overlay" onClick={() => setMarkPaidFor(null)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('finance.payoutRunDetail.markPaid')}</h3>
            <input className="input-field" style={{ width: '100%' }} placeholder={t('finance.payoutRunDetail.bankReference')} value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="btn-secondary" onClick={() => setMarkPaidFor(null)}>{t('common:cancel')}</button>
              <button className="btn-primary" disabled={!bankReference.trim()} onClick={submitMarkPaid}>{t('finance.payoutRunDetail.markPaid')}</button>
            </div>
          </div>
        </div>
      )}

      {markFailedFor && (
        <div className="modal-overlay" onClick={() => setMarkFailedFor(null)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('finance.payoutRunDetail.markFailed')}</h3>
            <textarea className="input-field" style={{ width: '100%', minHeight: '70px' }} placeholder={t('finance.payoutRunDetail.failReason')} value={failReason} onChange={(e) => setFailReason(e.target.value)} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button className="btn-secondary" onClick={() => setMarkFailedFor(null)}>{t('common:cancel')}</button>
              <button className="btn-danger" disabled={!failReason.trim()} onClick={submitMarkFailed}>{t('finance.payoutRunDetail.markFailed')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
