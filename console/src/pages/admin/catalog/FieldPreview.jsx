import { useTranslation } from 'react-i18next';
import { localized } from '../../../utils/localized';

// How the field will actually look on the seller's listing form (M3) —
// a real disabled control per type, not a description of one, so the
// field builder shows exactly what required/options/unit will produce.
export default function FieldPreview({ field }) {
  const { t, i18n } = useTranslation('admin');
  const label = localized(field.label, i18n.language) || t('catalog.fields.untitled');

  return (
    <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {t('catalog.fields.preview')}
      </div>
      <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
        {label}{field.required && <span style={{ color: 'var(--accent-red)' }}> *</span>}
        {field.unit && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({field.unit})</span>}
      </label>

      {field.type === 'text' && <input className="input-field" disabled placeholder={field.maxLength ? t('catalog.fields.maxLengthHint', { n: field.maxLength }) : ''} />}
      {field.type === 'number' && <input className="input-field" type="number" disabled placeholder={[field.min, field.max].filter((v) => v !== null && v !== undefined).join(' – ')} />}
      {field.type === 'date' && <input className="input-field" type="date" disabled />}
      {field.type === 'boolean' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <input type="checkbox" disabled /> {t('common:yes')}
        </label>
      )}
      {field.type === 'select' && (
        <select className="select-field" disabled>
          <option>{t('catalog.fields.selectPlaceholder')}</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value}>{localized(opt.label, i18n.language) || opt.value}</option>
          ))}
        </select>
      )}
      {field.type === 'multiselect' && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(field.options || []).length === 0
            ? <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.fields.noOptionsYet')}</span>
            : field.options.map((opt) => <span key={opt.value} className="badge badge-blue">{localized(opt.label, i18n.language) || opt.value}</span>)}
        </div>
      )}
      {field.type === 'fitment' && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {t('catalog.fields.fitmentPreview')}
        </div>
      )}
    </div>
  );
}
