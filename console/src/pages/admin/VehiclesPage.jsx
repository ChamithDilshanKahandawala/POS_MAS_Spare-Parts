import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Pencil, Search, X } from 'lucide-react';
import { getAdminVehicleMakes, createVehicleMake, updateVehicleMake } from '../../api/services';
import EmptyState from '../../components/EmptyState';

const VEHICLE_TYPES = ['car', 'van', 'suv', 'motorcycle', 'three_wheeler', 'lorry', 'bus'];

function emptyMake() {
  return { name: '', type: 'car', active: true, models: [] };
}

function VehicleMakeModal({ initial, onSave, onClose }) {
  const { t } = useTranslation(['admin', 'common']);
  const [make, setMake] = useState(initial ? { ...initial, models: initial.models.map((m) => ({ ...m })) } : emptyMake());
  const [saving, setSaving] = useState(false);

  const addModel = () => setMake((m) => ({ ...m, models: [...m.models, { name: '', yearFrom: null, yearTo: null, active: true }] }));
  const removeModel = (idx) => setMake((m) => ({ ...m, models: m.models.filter((_, i) => i !== idx) }));
  const setModel = (idx, patch) => setMake((m) => ({ ...m, models: m.models.map((mo, i) => (i === idx ? { ...mo, ...patch } : mo)) }));

  const canSave = make.name.trim() && make.models.every((m) => m.name.trim());

  const submit = async () => {
    setSaving(true);
    try {
      const payload = { name: make.name.trim(), type: make.type, active: make.active, models: make.models.map((m) => ({ ...m, name: m.name.trim() })) };
      if (initial) await updateVehicleMake(initial._id, payload);
      else await createVehicleMake(payload);
      toast.success(t('vehicles.saved'));
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>{initial ? t('vehicles.editTitle') : t('vehicles.addTitle')}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('vehicles.name')}</label>
            <input className="input-field" style={{ marginTop: '6px' }} value={make.name} onChange={(e) => setMake((m) => ({ ...m, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('vehicles.type')}</label>
            <select className="select-field" style={{ marginTop: '6px' }} value={make.type} onChange={(e) => setMake((m) => ({ ...m, type: e.target.value }))}>
              {VEHICLE_TYPES.map((ty) => <option key={ty} value={ty}>{t(`vehicles.types.${ty}`)}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '16px' }}>
          <input type="checkbox" checked={make.active} onChange={(e) => setMake((m) => ({ ...m, active: e.target.checked }))} />
          {t('vehicles.active')}
        </label>

        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('vehicles.models')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', marginBottom: '14px', maxHeight: '260px', overflowY: 'auto' }}>
          {make.models.map((m, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr)) auto auto', gap: '6px', alignItems: 'center' }}>
              <input className="input-field" placeholder={t('vehicles.modelName')} value={m.name} onChange={(e) => setModel(idx, { name: e.target.value })} />
              <input className="input-field" type="number" placeholder={t('vehicles.yearFrom')} value={m.yearFrom ?? ''} onChange={(e) => setModel(idx, { yearFrom: e.target.value === '' ? null : Number(e.target.value) })} />
              <input className="input-field" type="number" placeholder={t('vehicles.yearTo')} value={m.yearTo ?? ''} onChange={(e) => setModel(idx, { yearTo: e.target.value === '' ? null : Number(e.target.value) })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <input type="checkbox" checked={m.active} onChange={(e) => setModel(idx, { active: e.target.checked })} />
                {t('vehicles.active')}
              </label>
              <button type="button" className="btn-secondary" style={{ padding: '6px' }} onClick={() => removeModel(idx)}><X size={13} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', marginBottom: '20px' }} onClick={addModel}>
          <Plus size={12} /> {t('vehicles.addModel')}
        </button>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>{t('common:cancel')}</button>
          <button className="btn-primary" disabled={!canSave || saving} onClick={submit}>{t('common:save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [makes, setMakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = editing

  const load = useCallback(() => {
    setLoading(true);
    getAdminVehicleMakes({ search: search || undefined, limit: 200 })
      .then(({ data }) => setMakes(data.makes))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [search, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (make) => {
    try {
      await updateVehicleMake(make._id, { active: !make.active });
      load();
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  return (
    <div className="animate-fade">
      <Link className="btn-secondary" style={{ marginBottom: '16px', padding: '6px 12px', fontSize: '12px', display: 'inline-flex' }} to="/admin/catalog">
        <ArrowLeft size={14} /> {t('vehicles.backToCatalog')}
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title">{t('vehicles.title')}</h1>
        <button className="btn-primary" onClick={() => setEditing(null)}><Plus size={14} /> {t('vehicles.addMake')}</button>
      </div>

      <div className="console-search" style={{ maxWidth: '360px', marginBottom: '16px' }}>
        <Search size={14} />
        <input placeholder={t('vehicles.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : makes.length === 0 ? (
        <EmptyState title={t('vehicles.noResults')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {makes.map((make) => (
            <div key={make._id} className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{make.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t(`vehicles.types.${make.type}`)} · {t('vehicles.modelCount', { count: make.models.length })}
                </div>
              </div>
              {!make.active && <span className="badge badge-orange">{t('vehicles.inactive')}</span>}
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => toggleActive(make)}>
                {make.active ? t('vehicles.deactivate') : t('vehicles.activate')}
              </button>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditing(make)}>
                <Pencil size={13} /> {t('vehicles.edit')}
              </button>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <VehicleMakeModal initial={editing} onSave={() => { setEditing(undefined); load(); }} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
