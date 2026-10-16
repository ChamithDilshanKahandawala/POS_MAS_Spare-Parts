import { useTranslation } from 'react-i18next';
import { localized } from '../../../../utils/localized';
import FitmentPicker from '../FitmentPicker';
import EmptyState from '../../../../components/EmptyState';

function AttributeInput({ field, value, onChange, lang }) {
  const label = localized(field.label, lang) || field.key;

  if (field.type === 'select') {
    return (
      <select className="select-field" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label}…</option>
        {(field.options || []).map((o) => <option key={o.value} value={o.value}>{localized(o.label, lang)}</option>)}
      </select>
    );
  }
  if (field.type === 'multiselect') {
    const values = Array.isArray(value) ? value : [];
    const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {(field.options || []).map((o) => (
          <button
            key={o.value} type="button"
            className={values.includes(o.value) ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '5px 10px', fontSize: '12px' }}
            onClick={() => toggle(o.value)}
          >
            {localized(o.label, lang)}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {label}
      </label>
    );
  }
  if (field.type === 'date') {
    return <input type="date" className="input-field" value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === 'number') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input type="number" className="input-field" value={value ?? ''} min={field.min ?? undefined} max={field.max ?? undefined} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
        {field.unit && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{field.unit}</span>}
      </div>
    );
  }
  return <input type="text" className="input-field" value={value ?? ''} maxLength={field.maxLength || undefined} onChange={(e) => onChange(e.target.value)} />;
}

export default function StepDetails({ listing, effective, onChange }) {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const fields = effective?.attributeSchema || [];
  const nonFitmentFields = fields.filter((f) => f.type !== 'fitment');
  const fitmentField = fields.find((f) => f.type === 'fitment');

  const setAttribute = (key, value) => onChange({ attributes: { ...listing.attributes, [key]: value } });

  if (fields.length === 0) {
    return <EmptyState title={t('wizard.details.noFields')} />;
  }

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {fitmentField && (
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            {localized(fitmentField.label, i18n.language)}{fitmentField.required && <span style={{ color: 'var(--accent-red)' }}> *</span>}
          </label>
          <FitmentPicker value={listing.fitment || []} onChange={(fitment) => onChange({ fitment })} />
        </div>
      )}
      {nonFitmentFields.map((field) => (
        <div key={field.key}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            {localized(field.label, i18n.language)}{field.required && <span style={{ color: 'var(--accent-red)' }}> *</span>}
            {field.inheritedFrom && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>({t('wizard.details.inheritedFrom', { name: localized(field.inheritedFrom.name, i18n.language) })})</span>}
          </label>
          {field.helpText?.[i18n.language] || field.helpText?.en ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>{localized(field.helpText, i18n.language)}</div>
          ) : null}
          <AttributeInput field={field} value={listing.attributes?.[field.key]} onChange={(v) => setAttribute(field.key, v)} lang={i18n.language} />
        </div>
      ))}
    </div>
  );
}
