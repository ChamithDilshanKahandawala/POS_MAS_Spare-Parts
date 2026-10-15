import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Upload } from 'lucide-react';
import { submitSellerApplication } from '../../api/services';
import LanguageSwitcher from '../../components/layout/LanguageSwitcher';

const EMPTY_FORM = {
  storeName: '', legalName: '', brNumber: '', ownerName: '', nic: '', phone: '', email: '', address: '', district: '', categories: '',
};
const DOC_FIELDS = ['brCertificate', 'nicFront', 'nicBack'];

function FileField({ fieldKey, label, file, onChange }) {
  const { t } = useTranslation('seller');
  const inputId = `apply-file-${fieldKey}`;
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{label}</label>
      <input
        id={inputId} type="file" accept="application/pdf,image/jpeg,image/png" style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files[0] || null)}
      />
      <label htmlFor={inputId} className="btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
        <Upload size={14} /> {file ? file.name : t('apply.fileHint')}
      </label>
    </div>
  );
}

export default function ApplyPage() {
  const { t } = useTranslation(['seller', 'common']);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState({ brCertificate: null, nicFront: null, nicBack: null });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const canSubmit = Object.entries(form).every(([k, v]) => k === 'categories' || v.trim()) && DOC_FIELDS.every((f) => files[f]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      DOC_FIELDS.forEach((f) => formData.append(f, files[f]));
      await submitSellerApplication(formData);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || t('apply.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="glass-card animate-fade" style={{ padding: '40px 32px', width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <CheckCircle size={40} color="var(--accent-green)" style={{ marginBottom: '16px' }} />
          <h1 className="page-title" style={{ fontSize: '20px', marginBottom: '10px' }}>{t('apply.thankYouTitle')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>{t('apply.thankYouBody')}</p>
          <button className="btn-secondary" onClick={() => { setSubmitted(false); setForm(EMPTY_FORM); setFiles({ brCertificate: null, nicFront: null, nicBack: null }); }}>
            {t('apply.backToStart')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px', display: 'flex', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="glass-card animate-fade" style={{ padding: '32px', width: '100%', maxWidth: '560px', marginTop: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h1 className="page-title" style={{ fontSize: '22px' }}>{t('apply.heading')}</h1>
          <LanguageSwitcher />
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>{t('apply.subtitle')}</p>

        <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-primary-text)' }}>{t('apply.steps.business')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <Input label={t('apply.storeName')} value={form.storeName} onChange={field('storeName')} />
          <Input label={t('apply.legalName')} value={form.legalName} onChange={field('legalName')} />
          <Input label={t('apply.brNumber')} value={form.brNumber} onChange={field('brNumber')} />
          <Input label={t('apply.district')} value={form.district} onChange={field('district')} />
          <div style={{ gridColumn: '1 / -1' }}><Input label={t('apply.address')} value={form.address} onChange={field('address')} /></div>
          <div style={{ gridColumn: '1 / -1' }}><Input label={t('apply.categories')} value={form.categories} onChange={field('categories')} /></div>
        </div>

        <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-primary-text)' }}>{t('apply.steps.owner')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <Input label={t('apply.ownerName')} value={form.ownerName} onChange={field('ownerName')} />
          <Input label={t('apply.nic')} value={form.nic} onChange={field('nic')} />
          <Input label={t('apply.phone')} value={form.phone} onChange={field('phone')} />
          <Input label={t('apply.email')} type="email" value={form.email} onChange={field('email')} />
        </div>

        <h2 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-primary-text)' }}>{t('apply.steps.documents')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '8px' }}>
          <FileField fieldKey="brCertificate" label={t('apply.brCertificate')} file={files.brCertificate} onChange={(f) => setFiles((x) => ({ ...x, brCertificate: f }))} />
          <FileField fieldKey="nicFront" label={t('apply.nicFront')} file={files.nicFront} onChange={(f) => setFiles((x) => ({ ...x, nicFront: f }))} />
          <FileField fieldKey="nicBack" label={t('apply.nicBack')} file={files.nicBack} onChange={(f) => setFiles((x) => ({ ...x, nicBack: f }))} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '24px' }}>{t('apply.fileHint')}</div>

        {error && <div style={{ fontSize: '12px', color: 'var(--badge-red-text)', marginBottom: '14px' }}>{error}</div>}

        <button type="submit" className="btn-primary" disabled={!canSubmit || submitting} style={{ width: '100%', justifyContent: 'center' }}>
          {submitting ? t('apply.submitting') : t('apply.submit')}
        </button>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</span>
      <input type={type} className="input-field" value={value} onChange={onChange} required />
    </label>
  );
}
