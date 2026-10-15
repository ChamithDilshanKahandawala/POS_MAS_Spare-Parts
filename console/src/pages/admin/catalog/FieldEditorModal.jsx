import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import FieldPreview from './FieldPreview';

const FIELD_TYPES = ['text', 'number', 'select', 'multiselect', 'boolean', 'date', 'fitment'];

function emptyField() {
  return {
    key: '', label: { en: '', si: '', ta: '' }, helpText: { en: '', si: '', ta: '' },
    type: 'text', required: false, options: [], unit: '', min: null, max: null, maxLength: null,
    showOnProductPage: false, filterable: false,
  };
}

// Add/edit one attribute field. keyLocked is true once the field has a
// server _id on a category that already has listings — "Field keys ...
// can't be renamed once in use" (the spec's own words); a brand-new
// field (no _id yet) can always have its key set.
export default function FieldEditorModal({ initial, keyLocked, onSave, onClose }) {
  const { t } = useTranslation(['admin', 'common']);
  const [field, setField] = useState(initial ? { ...emptyField(), ...initial } : emptyField());

  const setLang = (groupKey, lang) => (e) => setField((f) => ({ ...f, [groupKey]: { ...f[groupKey], [lang]: e.target.value } }));

  const addOption = () => setField((f) => ({ ...f, options: [...f.options, { value: '', label: { en: '', si: '', ta: '' } }] }));
  const removeOption = (idx) => setField((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  const setOption = (idx, patch) => setField((f) => ({ ...f, options: f.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }));

  const canSave = field.key.trim() && field.label.en.trim() && (!['select', 'multiselect'].includes(field.type) || field.options.every((o) => o.value.trim() && o.label.en.trim()));

  const submit = () => {
    onSave({
      ...field,
      key: field.key.trim(),
      unit: field.unit?.trim() || undefined,
      maxLength: field.maxLength === '' ? null : field.maxLength,
      min: field.min === '' ? null : field.min,
      max: field.max === '' ? null : field.max,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>{initial ? t('catalog.fields.editTitle') : t('catalog.fields.addTitle')}</h3>

        <div className="field-editor-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.fields.key')}</label>
              <input
                className="input-field" style={{ marginTop: '6px' }}
                value={field.key} disabled={keyLocked}
                placeholder={t('catalog.fields.keyPlaceholder')}
                onChange={(e) => setField((f) => ({ ...f, key: e.target.value }))}
              />
              {keyLocked && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('catalog.fields.keyLocked')}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
              <LangInput label={t('catalog.fields.labelEn')} value={field.label.en} onChange={setLang('label', 'en')} />
              <LangInput label={t('catalog.fields.labelSi')} value={field.label.si} onChange={setLang('label', 'si')} />
              <LangInput label={t('catalog.fields.labelTa')} value={field.label.ta} onChange={setLang('label', 'ta')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
              <LangInput label={t('catalog.fields.helpTextEn')} value={field.helpText.en} onChange={setLang('helpText', 'en')} />
              <LangInput label={t('catalog.fields.helpTextSi')} value={field.helpText.si} onChange={setLang('helpText', 'si')} />
              <LangInput label={t('catalog.fields.helpTextTa')} value={field.helpText.ta} onChange={setLang('helpText', 'ta')} />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.fields.type')}</label>
              <select className="select-field" style={{ marginTop: '6px' }} value={field.type} onChange={(e) => setField((f) => ({ ...f, type: e.target.value, options: [] }))}>
                {FIELD_TYPES.map((ty) => <option key={ty} value={ty}>{t(`catalog.fields.types.${ty}`)}</option>)}
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <input type="checkbox" checked={field.required} onChange={(e) => setField((f) => ({ ...f, required: e.target.checked }))} />
              {t('catalog.fields.required')}
            </label>

            {field.type === 'number' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px' }}>
                <NumInput label={t('catalog.fields.unit')} value={field.unit} onChange={(v) => setField((f) => ({ ...f, unit: v }))} text />
                <NumInput label={t('catalog.fields.min')} value={field.min} onChange={(v) => setField((f) => ({ ...f, min: v }))} />
                <NumInput label={t('catalog.fields.max')} value={field.max} onChange={(v) => setField((f) => ({ ...f, max: v }))} />
              </div>
            )}
            {field.type === 'text' && (
              <NumInput label={t('catalog.fields.maxLength')} value={field.maxLength} onChange={(v) => setField((f) => ({ ...f, maxLength: v }))} />
            )}

            {['select', 'multiselect'].includes(field.type) && (
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.fields.options')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {field.options.map((opt, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr)) auto', gap: '6px', alignItems: 'center' }}>
                      <input className="input-field" placeholder={t('catalog.fields.optionValue')} value={opt.value} onChange={(e) => setOption(idx, { value: e.target.value })} />
                      <input className="input-field" placeholder={t('catalog.fields.labelEn')} value={opt.label.en} onChange={(e) => setOption(idx, { label: { ...opt.label, en: e.target.value } })} />
                      <input className="input-field" placeholder={t('catalog.fields.labelSi')} value={opt.label.si} onChange={(e) => setOption(idx, { label: { ...opt.label, si: e.target.value } })} />
                      <input className="input-field" placeholder={t('catalog.fields.labelTa')} value={opt.label.ta} onChange={(e) => setOption(idx, { label: { ...opt.label, ta: e.target.value } })} />
                      <button type="button" className="btn-secondary" style={{ padding: '6px' }} onClick={() => removeOption(idx)}><X size={13} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: '12px' }} onClick={addOption}>
                    <Plus size={12} /> {t('catalog.fields.addOption')}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input type="checkbox" checked={field.showOnProductPage} onChange={(e) => setField((f) => ({ ...f, showOnProductPage: e.target.checked }))} />
                {t('catalog.fields.showOnProductPage')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input type="checkbox" checked={field.filterable} onChange={(e) => setField((f) => ({ ...f, filterable: e.target.checked }))} />
                {t('catalog.fields.filterable')}
              </label>
            </div>
          </div>

          <FieldPreview field={field} />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn-secondary" onClick={onClose}>{t('common:cancel')}</button>
          <button className="btn-primary" disabled={!canSave} onClick={submit}>{t('common:save')}</button>
        </div>
      </div>
    </div>
  );
}

function LangInput({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</label>
      <input className="input-field" style={{ marginTop: '4px' }} value={value} onChange={onChange} />
    </div>
  );
}

function NumInput({ label, value, onChange, text }) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</label>
      <input
        className="input-field" style={{ marginTop: '4px' }}
        type={text ? 'text' : 'number'}
        value={value ?? ''}
        onChange={(e) => onChange(text ? e.target.value : (e.target.value === '' ? '' : Number(e.target.value)))}
      />
    </div>
  );
}
