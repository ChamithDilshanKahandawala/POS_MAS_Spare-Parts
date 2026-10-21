import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowLeft, Eye, Package, ShoppingCart, Wallet, Landmark, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getSeller, updateSellerStatus, updateSellerOverrides, viewAsSeller,
  getSellerBankFull, verifySellerBank, rejectSellerBank, getListingQueue,
  getSellerPosStatus, updateSellerPosConnection,
} from '../../api/services';
import { useAuth } from '../../context/useAuth';
import EmptyState from '../../components/EmptyState';

const STATUS_BADGE = { in_review: 'badge-yellow', active: 'badge-green', suspended: 'badge-orange', closed: 'badge-red' };

const TRANSITIONS = {
  in_review: ['approve'],
  active: ['suspend', 'close'],
  suspended: ['reactivate', 'close'],
  closed: [],
};

const BANK_STATUS_BADGE = { none: 'badge-blue', pending: 'badge-yellow', verified: 'badge-green', rejected: 'badge-red' };

const TABS = ['profile', 'status', 'commission', 'bank', 'pos', 'activity', 'listings', 'orders', 'finance'];
const POS_STATUS_BADGE = { off: 'badge-blue', connected: 'badge-green', failing: 'badge-red' };

export default function SellerDetailPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPlatformOwner, startViewAs } = useAuth();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [pendingAction, setPendingAction] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commissionPct, setCommissionPct] = useState('');
  const [probationUntil, setProbationUntil] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [fullAccountNumber, setFullAccountNumber] = useState(null);
  const [rejectReason, setRejectReason] = useState(null);
  const [reviewExempt, setReviewExempt] = useState(false);
  const [listings, setListings] = useState(null);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [posStatus, setPosStatus] = useState(null);
  const [posLoading, setPosLoading] = useState(false);
  const [posForm, setPosForm] = useState({ enabled: false, baseUrl: '', integrationKey: '', reason: '' });

  const load = useCallback(() => {
    setLoading(true);
    getSeller(id)
      .then(({ data }) => {
        setDetail(data);
        setCommissionPct(data.seller.commissionOverridePct ?? '');
        setProbationUntil(data.seller.probationUntil ? data.seller.probationUntil.slice(0, 10) : '');
        setReviewExempt(!!data.seller.reviewExempt);
      })
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [id, t]);

  // load (useCallback) sets state internally, so the static analysis
  // flags this the same way as AuthContext.jsx's session-restore effect —
  // this is the same legitimate case: fetch once on mount/filter-change,
  // not a render-triggered setState cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Lazy-loads the seller's listings only once, the first time the
  // Listings tab is actually opened — same fetch-on-change reasoning as
  // every other load() effect in this console.
  useEffect(() => {
    if (tab !== 'listings' || listings) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setListingsLoading(true);
    getListingQueue({ seller: id, status: 'all', limit: 50 })
      .then(({ data }) => setListings(data.listings))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setListingsLoading(false));
  }, [tab, id, listings, t]);

  const loadPosStatus = useCallback(() => {
    setPosLoading(true);
    getSellerPosStatus(id)
      .then(({ data }) => {
        setPosStatus(data);
        setPosForm((f) => ({ ...f, enabled: data.posConnection.enabled, baseUrl: data.posConnection.baseUrl }));
      })
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setPosLoading(false));
  }, [id, t]);

  // Lazy-loads the same way the Listings tab does above — only the first
  // time this tab is actually opened.
  useEffect(() => {
    if (tab !== 'pos' || posStatus) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPosStatus();
  }, [tab, posStatus, loadPosStatus]);

  const submitPosConnection = async () => {
    if (!posForm.reason.trim()) return;
    setSubmitting(true);
    try {
      const body = { enabled: posForm.enabled, baseUrl: posForm.baseUrl, reason: posForm.reason.trim() };
      if (posForm.integrationKey.trim()) body.integrationKey = posForm.integrationKey.trim();
      await updateSellerPosConnection(id, body);
      toast.success(t('sellerDetail.pos.saved'));
      setPosForm((f) => ({ ...f, integrationKey: '', reason: '' }));
      loadPosStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const dateTimeFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });

  const submitStatusChange = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await updateSellerStatus(id, pendingAction, reason.trim());
      toast.success(t('sellerDetail.statusUpdated'));
      setPendingAction(null);
      setReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitOverrides = async () => {
    if (!overrideReason.trim()) return;
    setSubmitting(true);
    try {
      await updateSellerOverrides(id, {
        commissionOverridePct: commissionPct === '' ? null : Number(commissionPct),
        probationUntil: probationUntil ? new Date(probationUntil).toISOString() : null,
        reviewExempt,
        reason: overrideReason.trim(),
      });
      toast.success(t('sellerDetail.commission.saved'));
      setOverrideReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewFullAccountNumber = async () => {
    try {
      const { data } = await getSellerBankFull(id);
      setFullAccountNumber(data.bankAccount.accountNumber);
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  const handleVerifyBank = async () => {
    setSubmitting(true);
    try {
      await verifySellerBank(id);
      toast.success(t('sellerDetail.bank.verified'));
      setFullAccountNumber(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRejectBank = async () => {
    if (!rejectReason?.trim()) return;
    setSubmitting(true);
    try {
      await rejectSellerBank(id, rejectReason.trim());
      toast.success(t('sellerDetail.bank.rejected'));
      setRejectReason(null);
      setFullAccountNumber(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewAs = async () => {
    try {
      const { data } = await viewAsSeller(id);
      startViewAs(data.token, data.seller.id, data.seller.name);
      toast.success(t('sellerDetail.viewAsStarted', { seller: data.seller.name }));
      navigate('/seller');
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!detail) return <div>{t('common:error.generic')}</div>;

  const { seller, members, recentActivity } = detail;
  const availableActions = TRANSITIONS[seller.status] || [];

  return (
    <div className="animate-fade">
      <button className="btn-secondary" style={{ marginBottom: '16px', padding: '6px 12px', fontSize: '12px' }} onClick={() => navigate('/admin/sellers')}>
        <ArrowLeft size={14} /> {t('sellerDetail.back')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{seller.name}</h1>
          <span className={`badge ${STATUS_BADGE[seller.status]}`} style={{ marginTop: '6px', display: 'inline-block' }}>
            {t(`sellers.status.${seller.status}`)}
          </span>
        </div>
        <button className="btn-secondary" onClick={handleViewAs}>
          <Eye size={14} /> {t('sellerDetail.viewAsButton')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>
        {TABS.map((key) => (
          <button
            key={key}
            className={tab === key ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 14px', fontSize: '12px' }}
            onClick={() => setTab(key)}
          >
            {t(`sellerDetail.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="glass-card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Field label={t('sellerDetail.profile.legalName')} value={seller.legalName} />
          <Field label={t('sellerDetail.profile.brNumber')} value={seller.brNumber} />
          <Field label={t('sellerDetail.profile.district')} value={seller.district} />
          <Field label={t('sellerDetail.profile.ownerName')} value={seller.ownerName} />
          <Field label={t('sellerDetail.profile.nic')} value={seller.nic} />
          <Field label={t('sellerDetail.profile.phone')} value={seller.phone} />
          <Field label={t('sellerDetail.profile.email')} value={seller.email} />
          <Field label={t('sellerDetail.profile.address')} value={seller.address} />
          <Field label={t('sellerDetail.profile.categories')} value={seller.categories?.join(', ')} />
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label={t('sellerDetail.profile.verificationNotes')} value={seller.verificationNotes} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('sellerDetail.profile.members')}</div>
            {members.length === 0 ? '—' : members.map((m) => (
              <span key={m._id} className="badge badge-blue" style={{ marginRight: '6px' }}>
                {m.user?.name} ({m.role})
              </span>
            ))}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{t('sellerDetail.profile.documents')}</div>
            {!seller.documents || seller.documents.length === 0 ? t('sellerDetail.profile.noDocuments') : seller.documents.map((d) => (
              <span key={d.type} className="badge badge-purple" style={{ marginRight: '6px' }}>{d.filename}</span>
            ))}
          </div>
        </div>
      )}

      {tab === 'status' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {availableActions.length === 0 ? (
            <EmptyState title={t('sellerDetail.noActionsAvailable', { status: t(`sellers.status.${seller.status}`) })} />
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {availableActions.map((action) => (
                <button key={action} className="btn-secondary" onClick={() => { setPendingAction(action); setReason(''); }}>
                  {t(`sellerDetail.actions.${action}`)}
                </button>
              ))}
            </div>
          )}

          {pendingAction && (
            <div className="modal-overlay" onClick={() => setPendingAction(null)}>
              <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('sellerDetail.confirmTitle', { action: t(`sellerDetail.actions.${pendingAction}`) })}</h3>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.reasonLabel')}</label>
                <textarea
                  className="input-field"
                  style={{ width: '100%', minHeight: '80px', marginTop: '6px', marginBottom: '16px' }}
                  placeholder={t('sellerDetail.reasonPlaceholder')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setPendingAction(null)}>{t('sellerDetail.cancel')}</button>
                  <button className="btn-primary" disabled={!reason.trim() || submitting} onClick={submitStatusChange}>{t('sellerDetail.confirm')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'commission' && (
        <div className="glass-card" style={{ padding: '20px', maxWidth: '420px' }}>
          {!isPlatformOwner && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>{t('sellerDetail.commission.ownerOnly')}</div>}
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.commission.overrideLabel')}</label>
          <input
            type="number" min="0" max="100" step="0.1"
            className="input-field" style={{ width: '100%', marginTop: '6px', marginBottom: '14px' }}
            placeholder={t('sellerDetail.commission.overridePlaceholder')}
            value={commissionPct}
            disabled={!isPlatformOwner}
            onChange={(e) => setCommissionPct(e.target.value)}
          />
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.commission.probationLabel')}</label>
          <input
            type="date"
            className="input-field" style={{ width: '100%', marginTop: '6px', marginBottom: '14px' }}
            value={probationUntil}
            disabled={!isPlatformOwner}
            onChange={(e) => setProbationUntil(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '14px' }}>
            <input type="checkbox" checked={reviewExempt} disabled={!isPlatformOwner} onChange={(e) => setReviewExempt(e.target.checked)} />
            {t('sellerDetail.commission.reviewExempt')}
          </label>
          {isPlatformOwner && (
            <>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.reasonLabel')}</label>
              <textarea
                className="input-field" style={{ width: '100%', minHeight: '60px', marginTop: '6px', marginBottom: '14px' }}
                placeholder={t('sellerDetail.reasonPlaceholder')}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
              <button className="btn-primary" disabled={!overrideReason.trim() || submitting} onClick={submitOverrides}>
                {t('sellerDetail.commission.save')}
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'bank' && (
        <div className="glass-card" style={{ padding: '20px', maxWidth: '420px' }}>
          <span className={`badge ${BANK_STATUS_BADGE[seller.bankAccount?.status || 'none']}`} style={{ marginBottom: '14px', display: 'inline-block' }}>
            {t(`sellerDetail.bank.status.${seller.bankAccount?.status || 'none'}`)}
          </span>

          {(seller.bankAccount?.status || 'none') === 'none' ? (
            <EmptyState title={t('sellerDetail.bank.noAccount')} />
          ) : (
            <>
              <Field label={t('sellerDetail.bank.bankName')} value={seller.bankAccount.bankName} />
              <Field label={t('sellerDetail.bank.branch')} value={seller.bankAccount.branch} />
              <Field label={t('sellerDetail.bank.accountName')} value={seller.bankAccount.accountName} />
              <div style={{ marginTop: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('sellerDetail.bank.accountNumber')}</div>
                {fullAccountNumber ? (
                  <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>{fullAccountNumber}</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>•••• {seller.bankAccount.last4}</span>
                    <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '11px' }} onClick={handleViewFullAccountNumber}>
                      <Landmark size={12} /> {t('sellerDetail.bank.viewFull')}
                    </button>
                  </div>
                )}
              </div>
              {seller.bankAccount.status === 'rejected' && seller.bankAccount.rejectedReason && (
                <Field label={t('sellerDetail.bank.rejectedReason')} value={seller.bankAccount.rejectedReason} />
              )}

              {seller.bankAccount.status === 'pending' && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button className="btn-secondary" disabled={submitting} onClick={() => setRejectReason('')}>{t('sellerDetail.bank.reject')}</button>
                  <button className="btn-primary" disabled={submitting} onClick={handleVerifyBank}>{t('sellerDetail.bank.verify')}</button>
                </div>
              )}
            </>
          )}

          {rejectReason !== null && (
            <div className="modal-overlay" onClick={() => setRejectReason(null)}>
              <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('sellerDetail.bank.reject')}</h3>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.reasonLabel')}</label>
                <textarea
                  className="input-field" style={{ width: '100%', minHeight: '80px', marginTop: '6px', marginBottom: '16px' }}
                  value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setRejectReason(null)}>{t('sellerDetail.cancel')}</button>
                  <button className="btn-primary" disabled={!rejectReason.trim() || submitting} onClick={submitRejectBank}>{t('sellerDetail.confirm')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'pos' && (
        <div className="glass-card" style={{ padding: '20px', maxWidth: '640px' }}>
          {posLoading || !posStatus ? <div>{t('common:loading')}</div> : (
            <>
              {(() => {
                const lastRun = posStatus.runs[0] || null;
                const computedStatus = !posStatus.posConnection.enabled
                  ? 'off'
                  : (lastRun?.status === 'failed' && posStatus.posConnection.consecutiveFailures >= 3 ? 'failing' : 'connected');
                return (
                  <span className={`badge ${POS_STATUS_BADGE[computedStatus]}`} style={{ marginBottom: '14px', display: 'inline-block' }}>
                    {t(`sellerDetail.pos.status.${computedStatus}`)}
                  </span>
                );
              })()}

              <Field label={t('sellerDetail.pos.keyLast4')} value={posStatus.posConnection.keyLast4 ? `•••• ${posStatus.posConnection.keyLast4}` : '—'} />
              <Field
                label={t('sellerDetail.pos.lastSuccessfulSync')}
                value={posStatus.posConnection.lastSuccessfulSyncAt ? dateTimeFormatter.format(new Date(posStatus.posConnection.lastSuccessfulSyncAt)) : t('sellerDetail.pos.never')}
              />

              {isPlatformOwner ? (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <input type="checkbox" checked={posForm.enabled} onChange={(e) => setPosForm((f) => ({ ...f, enabled: e.target.checked }))} />
                    {t('sellerDetail.pos.enabledLabel')}
                  </label>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.pos.baseUrl')}</label>
                    <input
                      className="input-field" style={{ width: '100%', marginTop: '6px' }}
                      placeholder="http://localhost:5001"
                      value={posForm.baseUrl}
                      onChange={(e) => setPosForm((f) => ({ ...f, baseUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.pos.integrationKey')}</label>
                    <input
                      className="input-field" style={{ width: '100%', marginTop: '6px' }}
                      type="password"
                      placeholder={t('sellerDetail.pos.integrationKeyPlaceholder')}
                      value={posForm.integrationKey}
                      onChange={(e) => setPosForm((f) => ({ ...f, integrationKey: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.reasonLabel')}</label>
                    <textarea
                      className="input-field" style={{ width: '100%', minHeight: '60px', marginTop: '6px' }}
                      placeholder={t('sellerDetail.reasonPlaceholder')}
                      value={posForm.reason}
                      onChange={(e) => setPosForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </div>
                  <button className="btn-primary" disabled={!posForm.reason.trim() || submitting} style={{ alignSelf: 'flex-start' }} onClick={submitPosConnection}>
                    {t('sellerDetail.pos.save')}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>{t('sellerDetail.commission.ownerOnly')}</div>
              )}

              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{t('sellerDetail.pos.recentRuns')}</div>
                {posStatus.runs.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('sellerDetail.pos.noRuns')}</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('sellerDetail.pos.table.started')}</th>
                        <th>{t('sellerDetail.pos.table.trigger')}</th>
                        <th>{t('sellerDetail.pos.table.status')}</th>
                        <th>{t('sellerDetail.pos.table.updated')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posStatus.runs.map((run) => (
                        <tr key={run._id}>
                          <td>{dateTimeFormatter.format(new Date(run.startedAt))}</td>
                          <td>{t(`sellerDetail.pos.trigger.${run.trigger}`)}</td>
                          <td>
                            <span className={`badge ${run.status === 'success' ? 'badge-green' : run.status === 'failed' ? 'badge-red' : 'badge-yellow'}`}>
                              {t(`sellerDetail.pos.runStatus.${run.status}`)}
                            </span>
                          </td>
                          <td>{run.listingsUpdated}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {recentActivity.length === 0 ? (
            <EmptyState title={t('sellerDetail.activity.empty')} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('auditLog.table.time')}</th>
                  <th>{t('auditLog.table.actor')}</th>
                  <th>{t('auditLog.table.action')}</th>
                  <th>{t('auditLog.table.summary')}</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((entry) => (
                  <tr key={entry._id}>
                    <td>{dateTimeFormatter.format(new Date(entry.createdAt))}</td>
                    <td>{entry.actorRole}</td>
                    <td>{entry.action}</td>
                    <td>{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'listings' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {listingsLoading ? (
            <div>{t('common:loading')}</div>
          ) : !listings || listings.length === 0 ? (
            <EmptyState icon={Package} title={t('sellerDetail.listings.empty')} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('products.table.title')}</th>
                  <th>{t('products.table.price')}</th>
                  <th>{t('products.table.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l._id}>
                    <td>{l.title?.en || t('products.untitled')}</td>
                    <td>Rs {(l.priceCents / 100).toLocaleString()}</td>
                    <td>
                      <span className="badge badge-blue">{t(`products.status.${l.status}`)}</span>
                      {l.needsUpdate && <AlertTriangle size={12} style={{ marginLeft: '6px', verticalAlign: '-2px', color: 'var(--accent-yellow)' }} />}
                    </td>
                    <td>
                      {['in_review', 'published', 'hidden', 'suspended'].includes(l.status) && (
                        <Link className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} to={`/admin/listing-review/${l._id}`}>
                          {t('sellerDetail.listings.view')}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === 'orders' && <EmptyState icon={ShoppingCart} title={t('sellerDetail.comingSoonTab')} />}
      {tab === 'finance' && <EmptyState icon={Wallet} title={t('sellerDetail.comingSoonTab')} />}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}
