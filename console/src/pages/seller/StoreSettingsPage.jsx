import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
import {
  getMyStore, updateMyStore, uploadLogo, uploadBanner, getLogoBlob, getBannerBlob,
} from '../../api/services';
import { useAuth } from '../../context/useAuth';
import BankAccountTab from './BankAccountTab';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function useObjectUrl(fetchBlob, deps) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    let localUrl = null;
    fetchBlob().then(({ data }) => {
      if (!active) return;
      localUrl = URL.createObjectURL(data);
      setUrl(localUrl);
    }).catch(() => { if (active) setUrl(null); });
    return () => {
      active = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return url;
}

function MediaUploader({ label, buttonLabel, changeLabel, hasExisting, objectUrl, onUpload, uploading }) {
  const { t } = useTranslation('seller');
  const inputId = `upload-${label.replace(/\s+/g, '-')}`;

  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>{label}</label>
      {objectUrl && (
        <img src={objectUrl} alt={label} style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '12px', marginBottom: '10px', display: 'block' }} />
      )}
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); e.target.value = ''; }}
      />
      <label htmlFor={inputId} className="btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
        <Upload size={14} /> {uploading ? t('common:loading') : (hasExisting ? changeLabel : buttonLabel)}
      </label>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{t('settings.profile.fileHint')}</div>
    </div>
  );
}

function ProfileTab() {
  const { t } = useTranslation(['seller', 'common']);
  const weekdayLabel = (day) => t(`settings.profile.days.${day}`);
  const { isActiveSellerOwner } = useAuth();
  const [seller, setSeller] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const [bannerVersion, setBannerVersion] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMyStore()
      .then(({ data }) => {
        setSeller(data.seller);
        setForm({
          displayName: data.seller.displayName || '',
          aboutText: { en: data.seller.aboutText?.en || '', si: data.seller.aboutText?.si || '', ta: data.seller.aboutText?.ta || '' },
          phones: data.seller.phones?.length ? data.seller.phones : [''],
          whatsapp: data.seller.whatsapp || '',
          email: data.seller.email || '',
          district: data.seller.district || '',
          address: data.seller.address || '',
          returnAddress: data.seller.returnAddress || '',
          operatingHours: WEEKDAYS.map((day) => data.seller.operatingHours?.find((d) => d.day === day) || { day, closed: true, open: '', close: '' }),
        });
      })
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // load (useCallback) sets state internally — same legitimate
  // fetch-on-mount case as every other page in this console.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const logoUrl = useObjectUrl(getLogoBlob, [logoVersion]);
  const bannerUrl = useObjectUrl(getBannerBlob, [bannerVersion]);

  if (loading || !form) return <div>{t('common:loading')}</div>;

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleLogoUpload = async (file) => {
    setUploadingLogo(true);
    try {
      const { data } = await uploadLogo(file);
      setSeller((s) => ({ ...s, logo: data.logo })); // keeps the "Change logo" label in sync without a full refetch
      setLogoVersion((v) => v + 1);
      toast.success(t('settings.profile.saved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (file) => {
    setUploadingBanner(true);
    try {
      const { data } = await uploadBanner(file);
      setSeller((s) => ({ ...s, banner: data.banner }));
      setBannerVersion((v) => v + 1);
      toast.success(t('settings.profile.saved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setUploadingBanner(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await updateMyStore({
        displayName: form.displayName,
        aboutText: form.aboutText,
        phones: form.phones.map((p) => p.trim()).filter(Boolean),
        whatsapp: form.whatsapp,
        email: form.email,
        district: form.district,
        address: form.address,
        returnAddress: form.returnAddress,
        operatingHours: form.operatingHours,
      });
      setSeller(data.seller);
      toast.success(t('settings.profile.saved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
      {!isActiveSellerOwner && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.viewOnly')}</div>}

      <div className="glass-card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <Field label={t('settings.profile.legalName')} value={seller.legalName} readOnly />
        <Field label={t('settings.profile.brNumber')} value={seller.brNumber} readOnly />
        <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: 'var(--text-muted)' }}>{t('settings.profile.readOnlyNotice')}</div>
      </div>

      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <TextInput label={t('settings.profile.displayName')} value={form.displayName} onChange={field('displayName')} disabled={!isActiveSellerOwner} />
        <TextArea label={t('settings.profile.aboutTextEn')} value={form.aboutText.en} onChange={(v) => setForm((f) => ({ ...f, aboutText: { ...f.aboutText, en: v } }))} disabled={!isActiveSellerOwner} />
        <TextArea label={t('settings.profile.aboutTextSi')} value={form.aboutText.si} onChange={(v) => setForm((f) => ({ ...f, aboutText: { ...f.aboutText, si: v } }))} disabled={!isActiveSellerOwner} />
        <TextArea label={t('settings.profile.aboutTextTa')} value={form.aboutText.ta} onChange={(v) => setForm((f) => ({ ...f, aboutText: { ...f.aboutText, ta: v } }))} disabled={!isActiveSellerOwner} />
      </div>

      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settings.profile.phones')}</label>
          {form.phones.map((phone, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <input
                className="input-field" style={{ flex: 1 }} value={phone} disabled={!isActiveSellerOwner}
                onChange={(e) => setForm((f) => ({ ...f, phones: f.phones.map((p, idx) => (idx === i ? e.target.value : p)) }))}
              />
              {isActiveSellerOwner && form.phones.length > 1 && (
                <button className="btn-secondary" style={{ padding: '8px' }} onClick={() => setForm((f) => ({ ...f, phones: f.phones.filter((_, idx) => idx !== i) }))}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {isActiveSellerOwner && form.phones.length < 3 && (
            <button className="btn-secondary" style={{ marginTop: '8px', fontSize: '12px', padding: '6px 10px' }} onClick={() => setForm((f) => ({ ...f, phones: [...f.phones, ''] }))}>
              {t('settings.profile.addPhone')}
            </button>
          )}
        </div>
        <TextInput label={t('settings.profile.whatsapp')} value={form.whatsapp} onChange={field('whatsapp')} disabled={!isActiveSellerOwner} />
        <TextInput label={t('settings.profile.email')} value={form.email} onChange={field('email')} disabled={!isActiveSellerOwner} />
        <TextInput label={t('settings.profile.district')} value={form.district} onChange={field('district')} disabled={!isActiveSellerOwner} />
        <TextArea label={t('settings.profile.address')} value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} disabled={!isActiveSellerOwner} />
        <TextArea label={t('settings.profile.returnAddress')} value={form.returnAddress} onChange={(v) => setForm((f) => ({ ...f, returnAddress: v }))} disabled={!isActiveSellerOwner} />
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>{t('settings.profile.hours')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {form.operatingHours.map((day, i) => (
            <div key={day.day} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ width: '36px', fontSize: '12px', fontWeight: 600 }}>{weekdayLabel(day.day)}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                <input
                  type="checkbox" checked={!day.closed} disabled={!isActiveSellerOwner}
                  onChange={(e) => setForm((f) => ({ ...f, operatingHours: f.operatingHours.map((d, idx) => (idx === i ? { ...d, closed: !e.target.checked } : d)) }))}
                />
                {t('settings.profile.open')}
              </label>
              {!day.closed && (
                <>
                  <input
                    type="time" className="input-field" style={{ width: 'auto' }} value={day.open} disabled={!isActiveSellerOwner}
                    onChange={(e) => setForm((f) => ({ ...f, operatingHours: f.operatingHours.map((d, idx) => (idx === i ? { ...d, open: e.target.value } : d)) }))}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>–</span>
                  <input
                    type="time" className="input-field" style={{ width: 'auto' }} value={day.close} disabled={!isActiveSellerOwner}
                    onChange={(e) => setForm((f) => ({ ...f, operatingHours: f.operatingHours.map((d, idx) => (idx === i ? { ...d, close: e.target.value } : d)) }))}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <MediaUploader
          label={t('settings.profile.logo')}
          buttonLabel={t('settings.profile.uploadLogo')}
          changeLabel={t('settings.profile.changeLogo')}
          hasExisting={!!seller.logo?.path}
          objectUrl={logoUrl}
          onUpload={handleLogoUpload}
          uploading={uploadingLogo}
        />
        <MediaUploader
          label={t('settings.profile.banner')}
          buttonLabel={t('settings.profile.uploadBanner')}
          changeLabel={t('settings.profile.changeBanner')}
          hasExisting={!!seller.banner?.path}
          objectUrl={bannerUrl}
          onUpload={handleBannerUpload}
          uploading={uploadingBanner}
        />
      </div>

      {isActiveSellerOwner && (
        <button className="btn-primary" disabled={saving} onClick={save} style={{ alignSelf: 'flex-start' }}>
          {t('settings.profile.save')}
        </button>
      )}
    </div>
  );
}

export default function StoreSettingsPage() {
  const { t } = useTranslation('seller');
  const [tab, setTab] = useState('profile');

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('settings.title')}</h1>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        <button className={tab === 'profile' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '7px 14px', fontSize: '12px' }} onClick={() => setTab('profile')}>
          {t('settings.tabs.profile')}
        </button>
        <button className={tab === 'bank' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '7px 14px', fontSize: '12px' }} onClick={() => setTab('bank')}>
          {t('settings.tabs.bank')}
        </button>
      </div>

      {tab === 'profile' ? <ProfileTab /> : <BankAccountTab />}
    </div>
  );
}

function Field({ label, value, readOnly }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, opacity: readOnly ? 0.7 : 1 }}>{value || '—'}</div>
    </div>
  );
}

function TextInput({ label, value, onChange, disabled }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</label>
      <input className="input-field" style={{ width: '100%', marginTop: '6px' }} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function TextArea({ label, value, onChange, disabled }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</label>
      <textarea className="input-field" style={{ width: '100%', minHeight: '70px', marginTop: '6px' }} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}
