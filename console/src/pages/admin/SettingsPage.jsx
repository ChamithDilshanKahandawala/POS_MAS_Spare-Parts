import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getSettings, updateSettings } from '../../api/services';
import { useAuth } from '../../context/useAuth';
import TagInput from '../../components/TagInput';

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'];

export default function SettingsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { isPlatformOwner } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getSettings()
      .then(({ data }) => setForm(data.settings))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // load (useCallback) sets state internally, so the static analysis
  // flags this the same way as AuthContext.jsx's session-restore effect —
  // this is the same legitimate case: fetch once on mount/filter-change,
  // not a render-triggered setState cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await updateSettings({
        defaultReturnWindowDays: Number(form.defaultReturnWindowDays),
        payoutDayOfWeek: Number(form.payoutDayOfWeek),
        payoutHoldDays: Number(form.payoutHoldDays),
        reviewRequiredForFirstNListings: Number(form.reviewRequiredForFirstNListings),
        supportPhone: form.supportPhone,
        supportEmail: form.supportEmail,
        supportWhatsapp: form.supportWhatsapp,
        prohibitedKeywords: form.prohibitedKeywords,
      });
      setForm(data.settings);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!form) return <div>{t('common:error.generic')}</div>;

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('settings.title')}</h1>

      <div className="glass-card" style={{ padding: '20px', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!isPlatformOwner && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.ownerOnly')}</div>}

        <NumberField label={t('settings.defaultReturnWindowDays')} value={form.defaultReturnWindowDays} onChange={field('defaultReturnWindowDays')} disabled={!isPlatformOwner} />

        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.payoutDayOfWeek')}</label>
          <select className="select-field" style={{ width: '100%', marginTop: '6px' }} value={form.payoutDayOfWeek} onChange={field('payoutDayOfWeek')} disabled={!isPlatformOwner}>
            {DAY_KEYS.map((d) => <option key={d} value={d}>{t(`settings.days.${d}`)}</option>)}
          </select>
        </div>

        <NumberField label={t('settings.payoutHoldDays')} value={form.payoutHoldDays} onChange={field('payoutHoldDays')} disabled={!isPlatformOwner} />
        <NumberField label={t('settings.reviewRequiredForFirstNListings')} value={form.reviewRequiredForFirstNListings} onChange={field('reviewRequiredForFirstNListings')} disabled={!isPlatformOwner} />

        <TextField label={t('settings.supportPhone')} value={form.supportPhone} onChange={field('supportPhone')} disabled={!isPlatformOwner} />
        <TextField label={t('settings.supportEmail')} value={form.supportEmail} onChange={field('supportEmail')} disabled={!isPlatformOwner} />
        <TextField label={t('settings.supportWhatsapp')} value={form.supportWhatsapp} onChange={field('supportWhatsapp')} disabled={!isPlatformOwner} />

        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>{t('settings.prohibitedKeywords')}</label>
          <TagInput
            value={form.prohibitedKeywords || []}
            onChange={(next) => setForm((f) => ({ ...f, prohibitedKeywords: next }))}
            placeholder={t('settings.prohibitedKeywordsPlaceholder')}
            disabled={!isPlatformOwner}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{t('settings.prohibitedKeywordsHint')}</div>
        </div>

        {isPlatformOwner && (
          <button className="btn-primary" disabled={saving} onClick={save} style={{ alignSelf: 'flex-start' }}>
            {t('settings.save')}
          </button>
        )}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, disabled }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</label>
      <input type="number" min="0" className="input-field" style={{ width: '100%', marginTop: '6px' }} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function TextField({ label, value, onChange, disabled }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</label>
      <input type="text" className="input-field" style={{ width: '100%', marginTop: '6px' }} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}
