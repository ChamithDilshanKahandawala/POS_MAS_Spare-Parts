import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { localized } from '../../../utils/localized';
import FieldEditorModal from './FieldEditorModal';

// Fields tab: the category's OWN fields (editable, reorderable) plus
// whatever it inherits and hasn't overridden (read-only, with an
// "Override" button that copies it in so the owner can customize it
// without losing the parent's definition).
export default function FieldsTab({ ownFields, onChangeOwnFields, effectiveFields, listingCount }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [editingIndex, setEditingIndex] = useState(null); // index into ownFields, or 'new', or null
  const ownKeys = new Set(ownFields.map((f) => f.key));
  const inheritedOnly = effectiveFields.filter((f) => f.inheritedFrom && !ownKeys.has(f.key));

  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= ownFields.length) return;
    const next = [...ownFields];
    [next[index], next[target]] = [next[target], next[index]];
    onChangeOwnFields(next);
  };

  const remove = (index) => onChangeOwnFields(ownFields.filter((_, i) => i !== index));

  const saveField = (field) => {
    if (editingIndex === 'new') {
      onChangeOwnFields([...ownFields, field]);
    } else {
      onChangeOwnFields(ownFields.map((f, i) => (i === editingIndex ? { ...f, ...field, _id: f._id } : f)));
    }
    setEditingIndex(null);
  };

  const overrideInherited = (field) => {
    const { inheritedFrom: _inheritedFrom, ...rest } = field;
    onChangeOwnFields([...ownFields, rest]);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700 }}>{t('catalog.fields.ownFields')}</h4>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingIndex('new')}>
          <Plus size={13} /> {t('catalog.fields.addField')}
        </button>
      </div>

      {ownFields.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('catalog.fields.noOwnFields')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {ownFields.map((field, index) => (
            <div key={field._id || field.key} className="glass-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {localized(field.label, i18n.language)}{field.required && <span style={{ color: 'var(--accent-red)' }}> *</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {field.key} · {t(`catalog.fields.types.${field.type}`)}
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '5px' }} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={13} /></button>
              <button className="btn-secondary" style={{ padding: '5px' }} disabled={index === ownFields.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13} /></button>
              <button className="btn-secondary" style={{ padding: '5px' }} onClick={() => setEditingIndex(index)}><Pencil size={13} /></button>
              <button className="btn-danger" style={{ padding: '5px' }} onClick={() => remove(index)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{t('catalog.fields.inheritedFields')}</h4>
      {inheritedOnly.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('catalog.fields.noInheritedFields')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {inheritedOnly.map((field) => (
            <div key={field.key} className="glass-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {localized(field.label, i18n.language)}{field.required && <span style={{ color: 'var(--accent-red)' }}> *</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {field.key} · {t(`catalog.fields.types.${field.type}`)} · {t('catalog.fields.inheritedFrom', { name: localized(field.inheritedFrom.name, i18n.language) })}
                </div>
              </div>
              <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => overrideInherited(field)}>
                <Copy size={12} /> {t('catalog.fields.override')}
              </button>
            </div>
          ))}
        </div>
      )}

      {editingIndex !== null && (
        <FieldEditorModal
          initial={editingIndex === 'new' ? null : ownFields[editingIndex]}
          keyLocked={editingIndex !== 'new' && listingCount > 0 && !!ownFields[editingIndex]._id}
          onSave={saveField}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
