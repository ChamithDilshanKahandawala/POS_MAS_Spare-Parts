import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { getMyBank, bankStepUpStart, bankStepUpVerify, updateMyBank } from '../../api/services';
import { useAuth } from '../../context/useAuth';

const STATUS_BADGE = { none: 'badge-blue', pending: 'badge-yellow', verified: 'badge-green', rejected: 'badge-red' };

export default function BankAccountTab() {
  const { t } = useTranslation(['seller', 'common']);
  const { isActiveSellerOwner } = useAuth();
  const [bankAccount, setBankAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stepUpConfirmed, setStepUpConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ bankName: '', branch: '', accountName: '', accountNumber: '', reason: '' });

  const load = useCallback(() => {
    setLoading(true);
    getMyBank()
      .then(({ data }) => setBankAccount(data.bankAccount))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // load (useCallback) sets state internally — legitimate fetch-on-mount,
  // same pattern as every other page.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const sendCode = async () => {
    if (!password) return;
    setSubmitting(true);
    try {
      await bankStepUpStart(password);
      setCodeSent(true);
      toast.success(t('settings.bank.codeSent'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCode = async () => {
    if (!code) return;
    setSubmitting(true);
    try {
      await bankStepUpVerify(code);
      setStepUpConfirmed(true);
      toast.success(t('settings.bank.confirmed'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const save = async () => {
    setSubmitting(true);
    try {
      const { data } = await updateMyBank(form);
      setBankAccount(data.bankAccount);
      setStepUpConfirmed(false);
      setCodeSent(false);
      setPassword('');
      setCode('');
      setForm({ bankName: '', branch: '', accountName: '', accountNumber: '', reason: '' });
      toast.success(t('settings.bank.saved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
      if (err.response?.status === 403) setStepUpConfirmed(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px' }}>
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span className={`badge ${STATUS_BADGE[bankAccount.status]}`}>{t(`settings.bank.status.${bankAccount.status}`)}</span>
        </div>
        {bankAccount.status === 'none' ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('settings.bank.noAccount')}</div>
        ) : (
          <div style={{ fontSize: '13px' }}>{t('settings.bank.currentAccount', { bankName: bankAccount.bankName, last4: bankAccount.last4 })}</div>
        )}
        {bankAccount.status === 'rejected' && bankAccount.rejectedReason && (
          <div style={{ fontSize: '12px', color: 'var(--badge-red-text)', marginTop: '8px' }}>
            {t('settings.bank.rejectedReason')}: {bankAccount.rejectedReason}
          </div>
        )}
      </div>

      {!isActiveSellerOwner && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.viewOnly')}</div>}

      {isActiveSellerOwner && !stepUpConfirmed && (
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <ShieldCheck size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{t('settings.bank.stepUpIntro')}</span>
          </div>

          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.bank.stepUpPassword')}</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', marginBottom: '14px' }}>
            <input type="password" className="input-field" style={{ flex: 1 }} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn-secondary" disabled={!password || submitting} onClick={sendCode}>{t('settings.bank.sendCode')}</button>
          </div>

          {codeSent && (
            <>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.bank.codeLabel')}</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  type="text" inputMode="numeric" maxLength={6} className="input-field" style={{ flex: 1, letterSpacing: '3px' }}
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <button className="btn-primary" disabled={code.length !== 6 || submitting} onClick={confirmCode}>{t('settings.bank.confirmCode')}</button>
              </div>
            </>
          )}
        </div>
      )}

      {isActiveSellerOwner && stepUpConfirmed && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <TextInput label={t('settings.bank.bankName')} value={form.bankName} onChange={(v) => setForm((f) => ({ ...f, bankName: v }))} />
          <TextInput label={t('settings.bank.branch')} value={form.branch} onChange={(v) => setForm((f) => ({ ...f, branch: v }))} />
          <TextInput label={t('settings.bank.accountName')} value={form.accountName} onChange={(v) => setForm((f) => ({ ...f, accountName: v }))} />
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.bank.accountNumber')}</label>
            <input
              className="input-field" style={{ width: '100%', marginTop: '6px' }} value={form.accountNumber}
              onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 20) }))}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('settings.bank.accountNumberHint')}</div>
          </div>
          <TextInput label={t('settings.bank.reason')} value={form.reason} onChange={(v) => setForm((f) => ({ ...f, reason: v }))} />

          <button
            className="btn-primary"
            disabled={submitting || !form.bankName || !form.branch || !form.accountName || form.accountNumber.length < 6}
            onClick={save}
            style={{ alignSelf: 'flex-start' }}
          >
            {t('settings.bank.save')}
          </button>
        </div>
      )}
    </div>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</label>
      <input className="input-field" style={{ width: '100%', marginTop: '6px' }} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
