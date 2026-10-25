import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { adminStepUpStart, adminStepUpVerify } from '../api/services';

// Milestone 7 — the admin-side password + OTP re-confirmation modal,
// shared by every owner-only, step-up-gated Finance action (adjustments,
// approving a payout run, exporting the bank file). Mirrors
// pages/seller/BankAccountTab.jsx's own step-up flow exactly, just
// packaged as a reusable modal instead of being inlined in one page,
// since Finance needs the same flow in three separate places.
export default function AdminStepUpModal({ open, onClose, onConfirmed, title }) {
  const { t } = useTranslation(['admin', 'common']);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => { setPassword(''); setCode(''); setCodeSent(false); };

  const sendCode = async () => {
    if (!password) return;
    setSubmitting(true);
    try {
      await adminStepUpStart(password);
      setCodeSent(true);
      toast.success(t('finance.stepUp.codeSent'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCode = async () => {
    if (code.length !== 6) return;
    setSubmitting(true);
    try {
      await adminStepUpVerify(code);
      reset();
      onConfirmed();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => { reset(); onClose(); }}>
      <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontWeight: 700, marginBottom: '6px' }}>{title || t('finance.stepUp.title')}</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>{t('finance.stepUp.intro')}</p>

        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('finance.stepUp.password')}</label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', marginBottom: '14px' }}>
          <input type="password" className="input-field" style={{ flex: 1 }} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn-secondary" disabled={!password || submitting} onClick={sendCode}>{t('finance.stepUp.sendCode')}</button>
        </div>

        {codeSent && (
          <>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('finance.stepUp.codeLabel')}</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', marginBottom: '14px' }}>
              <input
                type="text" inputMode="numeric" maxLength={6} className="input-field" style={{ flex: 1, letterSpacing: '3px' }}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button className="btn-primary" disabled={code.length !== 6 || submitting} onClick={confirmCode}>{t('finance.stepUp.confirm')}</button>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => { reset(); onClose(); }}>{t('common:cancel')}</button>
        </div>
      </div>
    </div>
  );
}
