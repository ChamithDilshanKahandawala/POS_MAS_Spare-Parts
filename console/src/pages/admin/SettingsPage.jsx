import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getSettings, updateSettings } from '../../api/services';
import { useAuth } from '../../context/useAuth';
import TagInput from '../../components/TagInput';

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'];
// Milestone 6 Part B — same 25-district list as marketplace-backend/
// utils/sriLankaDistricts.js; every district always has a rate entry
// (PlatformSettings' schema default backfills this), so this list is
// just for render order, not for deciding which districts exist.
const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota',
  'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara',
  'Moneragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];

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
  // Rupees in the UI, cents on the wire — same conversion as deliveryRates below.
  const fieldRupeesToCents = (key) => (e) => setForm((f) => ({ ...f, [key]: Math.round(Number(e.target.value) * 100) }));

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
        onlineOrderingEnabled: !!form.onlineOrderingEnabled,
        autoCancelAfterHours: Number(form.autoCancelAfterHours),
        courierName: form.courierName,
        deliveryRates: form.deliveryRates,
        refusedParcelChargedTo: form.refusedParcelChargedTo,
        minimumPayoutCents: Number(form.minimumPayoutCents),
        codNotReceivedAfterDays: Number(form.codNotReceivedAfterDays),
      });
      setForm(data.settings);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSaving(false);
    }
  };

  // Rupees in the UI, cents on the wire — same convention as every other
  // money field in this project (priceCents etc).
  const setDeliveryRate = (district, field, rupeeValue) => {
    setForm((f) => ({
      ...f,
      deliveryRates: {
        ...f.deliveryRates,
        [district]: { ...f.deliveryRates[district], [field]: Math.round(Number(rupeeValue) * 100) },
      },
    }));
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

        <div>
          <NumberField label={t('settings.payoutHoldDays')} value={form.payoutHoldDays} onChange={field('payoutHoldDays')} disabled={!isPlatformOwner} />
          {/* Follow-up — the backend only ever ACCEPTS a saved 0 when
              NODE_ENV is development/test (controllers/settingsController.js),
              so a currently-loaded 0 is proof we're already in one of
              those environments; no separate "what environment is this"
              call needed to decide whether to show the warning. */}
          {Number(form.payoutHoldDays) === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--badge-red-text, #ef4444)', marginTop: '4px', fontWeight: 600 }}>
              {t('settings.payoutHoldDaysDevWarning')}
            </div>
          )}
        </div>
        <NumberField label={t('settings.minimumPayoutCents')} value={(form.minimumPayoutCents || 0) / 100} onChange={fieldRupeesToCents('minimumPayoutCents')} disabled={!isPlatformOwner} />

        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.refusedParcelChargedTo')}</label>
          <select className="select-field" style={{ width: '100%', marginTop: '6px' }} value={form.refusedParcelChargedTo} onChange={field('refusedParcelChargedTo')} disabled={!isPlatformOwner}>
            <option value="platform">{t('settings.refusedParcelChargedToOptions.platform')}</option>
            <option value="seller">{t('settings.refusedParcelChargedToOptions.seller')}</option>
          </select>
        </div>

        <NumberField label={t('settings.codNotReceivedAfterDays')} value={form.codNotReceivedAfterDays} onChange={field('codNotReceivedAfterDays')} disabled={!isPlatformOwner} />
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

      {/* --- Milestone 6: ordering --- */}
      <div className="glass-card" style={{ padding: '20px', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800 }}>{t('settings.ordering.heading')}</h2>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isPlatformOwner ? 'pointer' : 'default' }}>
          <input
            type="checkbox" checked={!!form.onlineOrderingEnabled} disabled={!isPlatformOwner}
            onChange={(e) => setForm((f) => ({ ...f, onlineOrderingEnabled: e.target.checked }))}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
          />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('settings.ordering.enable')}</span>
        </label>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '-8px' }}>{t('settings.ordering.enableHint')}</div>

        <NumberField label={t('settings.ordering.autoCancelAfterHours')} value={form.autoCancelAfterHours} onChange={field('autoCancelAfterHours')} disabled={!isPlatformOwner} />
        <TextField label={t('settings.ordering.courierName')} value={form.courierName} onChange={field('courierName')} disabled={!isPlatformOwner} />

        {isPlatformOwner && (
          <button className="btn-primary" disabled={saving} onClick={save} style={{ alignSelf: 'flex-start' }}>
            {t('settings.save')}
          </button>
        )}
      </div>

      {/* --- Milestone 6: delivery rates per district --- */}
      <div className="glass-card" style={{ padding: '20px', maxWidth: '640px', marginTop: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>{t('settings.deliveryRates.heading')}</h2>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>{t('settings.deliveryRates.hint')}</div>
        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('settings.deliveryRates.district')}</th>
                <th>{t('settings.deliveryRates.firstKg')}</th>
                <th>{t('settings.deliveryRates.additionalKg')}</th>
              </tr>
            </thead>
            <tbody>
              {DISTRICTS.map((d) => {
                const rate = form.deliveryRates?.[d] || { firstKgCents: 0, additionalKgCents: 0 };
                return (
                  <tr key={d}>
                    <td style={{ fontSize: '12.5px' }}>{d}</td>
                    <td>
                      <input
                        type="number" min="0" className="input-field" style={{ width: '100px' }}
                        value={rate.firstKgCents / 100} disabled={!isPlatformOwner}
                        onChange={(e) => setDeliveryRate(d, 'firstKgCents', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" className="input-field" style={{ width: '100px' }}
                        value={rate.additionalKgCents / 100} disabled={!isPlatformOwner}
                        onChange={(e) => setDeliveryRate(d, 'additionalKgCents', e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isPlatformOwner && (
          <button className="btn-primary" disabled={saving} onClick={save} style={{ marginTop: '16px' }}>
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
