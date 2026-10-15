import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowLeft, FileText } from 'lucide-react';
import {
  getApplication, getApplicationDocumentBlob, updateApplicationChecklist,
  addApplicationNote, requestApplicationInfo, approveApplication, rejectApplication,
} from '../../api/services';

const STATUS_BADGE = { new: 'badge-blue', info_requested: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' };
const CHECKLIST_KEYS = ['brVerified', 'nicVerified', 'phoneCalled', 'addressChecked'];
const DOCUMENT_TYPES = ['br_certificate', 'nic_front', 'nic_back'];

export default function ApplicationDetailPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // 'requestInfo' | 'approve' | 'reject'
  const [actionText, setActionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getApplication(id)
      .then(({ data }) => setApplication(data.application))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [id, t]);

  // load (useCallback) sets state internally, so the static analysis
  // flags this the same way as AuthContext.jsx's session-restore effect —
  // this is the same legitimate case: fetch once on mount/filter-change,
  // not a render-triggered setState cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  const toggleChecklist = async (key) => {
    try {
      const { data } = await updateApplicationChecklist(id, { [key]: !application.checklist[key] });
      setApplication(data.application);
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    try {
      const { data } = await addApplicationNote(id, noteText.trim());
      setApplication(data.application);
      setNoteText('');
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  const openDocument = async (type) => {
    try {
      const { data } = await getApplicationDocumentBlob(id, type);
      const url = URL.createObjectURL(data);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  const confirmAction = async () => {
    setSubmitting(true);
    try {
      if (pendingAction === 'requestInfo') {
        if (!actionText.trim()) return;
        const { data } = await requestApplicationInfo(id, actionText.trim());
        setApplication(data.application);
      } else if (pendingAction === 'approve') {
        await approveApplication(id);
        load();
      } else if (pendingAction === 'reject') {
        if (!actionText.trim()) return;
        const { data } = await rejectApplication(id, actionText.trim());
        setApplication(data.application);
      }
      toast.success(t('applications.decisionDone'));
      setPendingAction(null);
      setActionText('');
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!application) return <div>{t('common:error.generic')}</div>;

  const decided = ['approved', 'rejected'].includes(application.status);

  return (
    <div className="animate-fade">
      <button className="btn-secondary" style={{ marginBottom: '16px', padding: '6px 12px', fontSize: '12px' }} onClick={() => navigate('/admin/applications')}>
        <ArrowLeft size={14} /> {t('applications.back')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{application.storeName}</h1>
          <span className={`badge ${STATUS_BADGE[application.status]}`} style={{ marginTop: '6px', display: 'inline-block' }}>
            {t(`applications.status.${application.status}`)}
          </span>
        </div>
        {!decided && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => { setPendingAction('requestInfo'); setActionText(''); }}>{t('applications.actions.requestInfo')}</button>
            <button className="btn-secondary" onClick={() => { setPendingAction('reject'); setActionText(''); }}>{t('applications.actions.reject')}</button>
            <button className="btn-primary" onClick={() => { setPendingAction('approve'); setActionText(''); }}>{t('applications.actions.approve')}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div className="glass-card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <Field label={t('applications.detail.legalName')} value={application.legalName} />
            <Field label={t('applications.detail.brNumber')} value={application.brNumber} />
            <Field label={t('applications.detail.ownerName')} value={application.ownerName} />
            <Field label={t('applications.detail.nic')} value={application.nic} />
            <Field label={t('applications.detail.phone')} value={application.phone} />
            <Field label={t('applications.detail.email')} value={application.email} />
            <Field label={t('applications.detail.district')} value={application.district} />
            <Field label={t('applications.detail.submitted')} value={dateFormatter.format(new Date(application.createdAt))} />
            <div style={{ gridColumn: '1 / -1' }}><Field label={t('applications.detail.address')} value={application.address} /></div>
            <div style={{ gridColumn: '1 / -1' }}><Field label={t('applications.detail.categories')} value={application.categories?.join(', ')} /></div>
            {application.infoRequestedMessage && (
              <div style={{ gridColumn: '1 / -1' }}><Field label={t('applications.detail.infoRequestedMessage')} value={application.infoRequestedMessage} /></div>
            )}
            {application.rejectedReason && (
              <div style={{ gridColumn: '1 / -1' }}><Field label={t('applications.detail.rejectedReason')} value={application.rejectedReason} /></div>
            )}
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>{t('applications.detail.documents')}</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {DOCUMENT_TYPES.map((type) => {
                const doc = application.documents?.find((d) => d.type === type);
                return (
                  <button key={type} className="btn-secondary" disabled={!doc} onClick={() => openDocument(type)}>
                    <FileText size={14} /> {t(`applications.detail.documentTypes.${type}`)} — {t('applications.detail.viewDocument')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>{t('applications.detail.checklist')}</h2>
            {CHECKLIST_KEYS.map((key) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!application.checklist[key]} onChange={() => toggleChecklist(key)} />
                {t(`applications.detail.checklistItems.${key}`)}
              </label>
            ))}
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>{t('applications.detail.notes')}</h2>
            {application.notes.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>{t('applications.detail.noNotes')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {application.notes.map((n) => (
                  <div key={n._id} style={{ fontSize: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{n.authorName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {dateFormatter.format(new Date(n.createdAt))}</span></div>
                    <div>{n.text}</div>
                  </div>
                ))}
              </div>
            )}
            <textarea
              className="input-field" style={{ width: '100%', minHeight: '60px', marginBottom: '8px' }}
              placeholder={t('applications.detail.notePlaceholder')}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button className="btn-secondary" disabled={!noteText.trim()} onClick={submitNote}>{t('applications.detail.addNote')}</button>
          </div>
        </div>
      </div>

      {pendingAction && (
        <div className="modal-overlay" onClick={() => setPendingAction(null)}>
          <div className="modal-box" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t(`applications.actions.${pendingAction === 'requestInfo' ? 'requestInfo' : pendingAction}`)}</h3>
            {pendingAction === 'approve' ? (
              <p style={{ fontSize: '13px', marginBottom: '16px' }}>{t('applications.approveConfirm')}</p>
            ) : (
              <textarea
                className="input-field" style={{ width: '100%', minHeight: '80px', marginBottom: '16px' }}
                placeholder={t(pendingAction === 'requestInfo' ? 'applications.requestInfoPlaceholder' : 'applications.rejectReasonPlaceholder')}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
              />
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setPendingAction(null)}>{t('applications.cancel')}</button>
              <button
                className="btn-primary"
                disabled={submitting || (pendingAction !== 'approve' && !actionText.trim())}
                onClick={confirmAction}
              >
                {t('applications.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
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
