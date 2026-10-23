import { useState, useEffect, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Car } from 'lucide-react';
import { getVehicleMakes } from '../api/marketplaceServices';

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' };

// Make -> model -> year cascading picker. `onSelect` receives
// { makeId, makeName, modelName, year } — the same shape
// utils/selectedVehicle.js stores and marketplaceAdapters.js's
// listingFitsVehicle() reads. Used on the home page (Part D.1) and
// re-opened from VehicleFilterBar's "change" action on category/search.
export default function VehiclePicker({ onSelect, initial }) {
  const { t } = useTranslation('marketplace');
  // Lighthouse (select-name) flagged these three <select>s as unlabeled —
  // a visible <label> sat next to each one but was never actually
  // associated via htmlFor/id, so screen readers announced them with no
  // name at all.
  const uid = useId();
  const makeFieldId = `${uid}-make`;
  const modelFieldId = `${uid}-model`;
  const yearFieldId = `${uid}-year`;
  const [makes, setMakes] = useState([]);
  const [makeId, setMakeId] = useState(initial?.makeId || '');
  const [modelName, setModelName] = useState(initial?.modelName || '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');

  useEffect(() => {
    getVehicleMakes().then(({ data }) => setMakes(data.makes || [])).catch(() => {});
  }, []);

  const selectedMake = useMemo(() => makes.find((m) => m.id === makeId), [makes, makeId]);
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 1980 + 2 }, (_, i) => current + 1 - i);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!makeId || !modelName) return;
    onSelect({ makeId, makeName: selectedMake?.name || '', modelName, year: year ? Number(year) : null });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 150px', minWidth: 0 }}>
        <label htmlFor={makeFieldId} style={labelStyle}>{t('vehiclePicker.make')}</label>
        <select
          id={makeFieldId} className="select-field" style={{ width: '100%' }} value={makeId}
          onChange={(e) => { setMakeId(e.target.value); setModelName(''); }}
        >
          <option value="">{t('vehiclePicker.selectMake')}</option>
          {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div style={{ flex: '1 1 150px', minWidth: 0 }}>
        <label htmlFor={modelFieldId} style={labelStyle}>{t('vehiclePicker.model')}</label>
        <select
          id={modelFieldId} className="select-field" style={{ width: '100%' }} value={modelName} disabled={!selectedMake}
          onChange={(e) => setModelName(e.target.value)}
        >
          <option value="">{t('vehiclePicker.selectModel')}</option>
          {(selectedMake?.models || []).map((mo) => <option key={mo.id} value={mo.name}>{mo.name}</option>)}
        </select>
      </div>
      <div style={{ flex: '1 1 110px', minWidth: 0 }}>
        <label htmlFor={yearFieldId} style={labelStyle}>{t('vehiclePicker.year')}</label>
        <select id={yearFieldId} className="select-field" style={{ width: '100%' }} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">{t('vehiclePicker.anyYear')}</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <button type="submit" className="btn-primary" disabled={!makeId || !modelName}>
        <Car size={15} /> {t('vehiclePicker.showParts')}
      </button>
    </form>
  );
}
