import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { getPublicVehicles } from '../../../api/services';

export default function FitmentPicker({ value, onChange }) {
  const { t } = useTranslation(['seller', 'common']);
  const [makes, setMakes] = useState([]);
  const [makeId, setMakeId] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [modelName, setModelName] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');

  useEffect(() => { getPublicVehicles().then(({ data }) => setMakes(data.makes)).catch(() => {}); }, []);

  const selectedMake = makes.find((m) => m.id === makeId);
  const filteredModels = useMemo(() => {
    if (!selectedMake) return [];
    const q = modelSearch.trim().toLowerCase();
    return selectedMake.models.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [selectedMake, modelSearch]);

  const add = () => {
    if (!makeId) return;
    const entry = { makeId, modelName: modelName.trim(), yearFrom: yearFrom ? Number(yearFrom) : null, yearTo: yearTo ? Number(yearTo) : null };
    onChange([...(value || []), entry]);
    setModelName(''); setModelSearch(''); setYearFrom(''); setYearTo('');
  };

  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  const makeName = (id) => makes.find((m) => m.id === id)?.name || id;

  return (
    <div>
      {(value || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {value.map((f, idx) => (
            <span key={idx} className="badge badge-blue">
              {makeName(f.makeId)}{f.modelName ? ` ${f.modelName}` : ''}{(f.yearFrom || f.yearTo) ? ` (${f.yearFrom || ''}-${f.yearTo || ''})` : ''}
              <button type="button" onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'inherit', padding: 0 }}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('wizard.fitment.make')}</label>
          <select className="select-field" style={{ marginTop: '4px' }} value={makeId} onChange={(e) => { setMakeId(e.target.value); setModelSearch(''); setModelName(''); }}>
            <option value="">{t('wizard.fitment.selectMake')}</option>
            {makes.map((m) => <option key={m.id} value={m.id}>{m.name} ({t(`wizard.fitment.types.${m.type}`)})</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('wizard.fitment.model')}</label>
          <input
            className="input-field" style={{ marginTop: '4px' }} list="fitment-models"
            value={modelName} onChange={(e) => { setModelName(e.target.value); setModelSearch(e.target.value); }}
            placeholder={t('wizard.fitment.modelPlaceholder')} disabled={!makeId}
          />
          <datalist id="fitment-models">
            {filteredModels.map((m) => <option key={m.id} value={m.name} />)}
          </datalist>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('wizard.fitment.yearFrom')}</label>
          <input className="input-field" style={{ marginTop: '4px' }} type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('wizard.fitment.yearTo')}</label>
          <input className="input-field" style={{ marginTop: '4px' }} type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary" disabled={!makeId} onClick={add}><Plus size={13} /> {t('wizard.fitment.add')}</button>
      </div>
    </div>
  );
}
