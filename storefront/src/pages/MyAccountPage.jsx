import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { User, MapPin, Car, Plus, Trash2, Star, Check } from 'lucide-react';
import {
  getCustomerProfile, updateCustomerProfile,
  getCustomerAddresses, createCustomerAddress, updateCustomerAddress, deleteCustomerAddress,
  getCustomerVehicles, createCustomerVehicle, deleteCustomerVehicle,
  getVehicleMakes,
} from '../api/marketplaceServices';
import { setSelectedVehicle } from '../utils/selectedVehicle';
import { SRI_LANKA_DISTRICTS } from '../utils/districts';

// Marketplace-only — Milestone 5 Part C.5's "My account (profile,
// addresses, my vehicles)". Never routed to in pos mode.
const TABS = ['profile', 'addresses', 'vehicles'];

function ProfileTab() {
  const { t } = useTranslation(['account', 'common']);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getCustomerProfile().then(({ data }) => setForm(data.profile)).catch(() => toast.error(t('common:error.generic')));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  if (!form) return <div>{t('common:loading')}</div>;

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await updateCustomerProfile({ name: form.name, phone: form.phone, preferredLanguage: form.preferredLanguage });
      setForm((f) => ({ ...f, ...data.profile }));
      toast.success(t('profile.saved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '24px', borderRadius: '18px', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelStyle}>{t('profile.name')}</label>
        <input className="input-field" style={{ width: '100%' }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>{t('profile.email')}</label>
        <input className="input-field" style={{ width: '100%', opacity: 0.6 }} value={form.email} disabled />
      </div>
      <div>
        <label style={labelStyle}>{t('profile.phone')}</label>
        <input className="input-field" style={{ width: '100%' }} value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="account-preferred-language" style={labelStyle}>{t('profile.preferredLanguage')}</label>
        <select id="account-preferred-language" className="select-field" style={{ width: '100%' }} value={form.preferredLanguage} onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}>
          <option value="en">English</option>
          <option value="si">සිංහල</option>
          <option value="ta">தமிழ்</option>
        </select>
      </div>
      <button className="btn-primary" disabled={saving} onClick={save} style={{ alignSelf: 'flex-start' }}>{t('profile.save')}</button>
    </div>
  );
}

function AddressesTab() {
  const { t } = useTranslation(['account', 'common']);
  const [addresses, setAddresses] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', line1: '', line2: '', city: '', district: '', landmark: '', phone: '' });

  const load = useCallback(() => {
    getCustomerAddresses().then(({ data }) => setAddresses(data.addresses)).catch(() => toast.error(t('common:error.generic')));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createCustomerAddress(form);
      toast.success(t('addresses.added'));
      setAdding(false);
      setForm({ label: '', line1: '', line2: '', city: '', district: '', landmark: '', phone: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const makeDefault = async (id) => {
    try {
      await updateCustomerAddress(id, { isDefault: true });
      load();
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  const remove = async (id) => {
    try {
      await deleteCustomerAddress(id);
      toast.success(t('addresses.removed'));
      load();
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  if (!addresses) return <div>{t('common:loading')}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '560px' }}>
      {addresses.map((a) => (
        <div key={a._id} className="glass-card" style={{ padding: '16px 18px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>{a.label || t('addresses.untitled')}</span>
              {a.isDefault && <span className="badge badge-green">{t('addresses.default')}</span>}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.district}
              {a.landmark ? ` (${a.landmark})` : ''}
              <br />{a.phone}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {!a.isDefault && (
              <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '11px' }} onClick={() => makeDefault(a._id)}>
                <Star size={12} /> {t('addresses.makeDefault')}
              </button>
            )}
            <button className="btn-danger" style={{ padding: '6px 10px', fontSize: '11px' }} onClick={() => remove(a._id)}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}

      {addresses.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('addresses.empty')}</p>}

      {adding ? (
        <form onSubmit={submit} className="glass-card" style={{ padding: '18px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input className="input-field" placeholder={t('addresses.label')} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          <input className="input-field" placeholder={t('addresses.line1')} required value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} />
          <input className="input-field" placeholder={t('addresses.line2')} value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input className="input-field" placeholder={t('addresses.city')} required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <select className="select-field" required aria-label={t('addresses.selectDistrict')} value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}>
              <option value="">{t('addresses.selectDistrict')}</option>
              {SRI_LANKA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <input className="input-field" placeholder={t('addresses.landmark')} value={form.landmark} onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))} />
          <input className="input-field" placeholder={t('addresses.phone')} required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>{t('common:cancel')}</button>
            <button type="submit" className="btn-primary">{t('addresses.save')}</button>
          </div>
        </form>
      ) : (
        addresses.length < 10 && (
          <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}>
            <Plus size={14} /> {t('addresses.addNew')}
          </button>
        )
      )}
    </div>
  );
}

function VehiclesTab() {
  const { t } = useTranslation(['account', 'common']);
  const [vehicles, setVehicles] = useState(null);
  const [makes, setMakes] = useState([]);
  const [form, setForm] = useState({ makeId: '', modelName: '', year: '' });

  const load = useCallback(() => {
    getCustomerVehicles().then(({ data }) => setVehicles(data.vehicles)).catch(() => toast.error(t('common:error.generic')));
  }, [t]);

  useEffect(() => { load(); getVehicleMakes().then(({ data }) => setMakes(data.makes || [])).catch(() => {}); }, [load]);

  const selectedMake = makes.find((m) => m.id === form.makeId);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createCustomerVehicle({ makeId: form.makeId, modelName: form.modelName, year: form.year ? Number(form.year) : null });
      toast.success(t('vehicles.added'));
      setForm({ makeId: '', modelName: '', year: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const remove = async (id) => {
    try {
      await deleteCustomerVehicle(id);
      load();
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  const selectVehicleForFiltering = (v) => {
    setSelectedVehicle({ makeId: v.makeId?._id || v.makeId, makeName: v.makeId?.name || '', modelName: v.modelName, year: v.year });
    toast.success(t('vehicles.nowFiltering'));
  };

  if (!vehicles) return <div>{t('common:loading')}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px' }}>
      {vehicles.map((v) => (
        <div key={v._id} className="glass-card" style={{ padding: '14px 16px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Car size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
              {v.makeId?.name} {v.modelName} {v.year || ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '11px' }} onClick={() => selectVehicleForFiltering(v)}>
              <Check size={12} /> {t('vehicles.useForFiltering')}
            </button>
            <button className="btn-danger" style={{ padding: '6px 10px', fontSize: '11px' }} onClick={() => remove(v._id)}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}

      {vehicles.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('vehicles.empty')}</p>}

      <form onSubmit={submit} className="glass-card" style={{ padding: '18px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <select className="select-field" required aria-label={t('vehicles.selectMake')} value={form.makeId} onChange={(e) => setForm((f) => ({ ...f, makeId: e.target.value, modelName: '' }))}>
          <option value="">{t('vehicles.selectMake')}</option>
          {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="select-field" required aria-label={t('vehicles.selectModel')} disabled={!selectedMake} value={form.modelName} onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}>
          <option value="">{t('vehicles.selectModel')}</option>
          {(selectedMake?.models || []).map((mo) => <option key={mo.id} value={mo.name}>{mo.name}</option>)}
        </select>
        <input className="input-field" type="number" placeholder={t('vehicles.yearOptional')} value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}><Plus size={14} /> {t('vehicles.add')}</button>
      </form>
    </div>
  );
}

export default function MyAccountPage() {
  const { t } = useTranslation('account');
  const [tab, setTab] = useState('profile');

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <User size={22} /> {t('title')}
      </h1>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>
        {TABS.map((key) => (
          <button
            key={key} className={tab === key ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setTab(key)}
          >
            {key === 'addresses' && <MapPin size={14} />} {key === 'vehicles' && <Car size={14} />}
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'addresses' && <AddressesTab />}
      {tab === 'vehicles' && <VehiclesTab />}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' };
