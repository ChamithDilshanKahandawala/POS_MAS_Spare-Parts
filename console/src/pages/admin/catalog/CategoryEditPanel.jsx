import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { updateCategory, deleteCategory } from '../../../api/services';
import { localized } from '../../../utils/localized';
import TagInput from '../../../components/TagInput';
import FieldsTab from './FieldsTab';

const TABS = ['basics', 'rules', 'fields', 'keywords'];

// null means "inherit from parent" (the nullable-sentinel design —
// backend/models/Category.js); true/false is an explicit override.
function NullableBooleanSelect({ value, onChange, disabled, effectiveValue, t }) {
  return (
    <select
      className="select-field"
      value={value === null || value === undefined ? 'inherit' : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === 'inherit' ? null : e.target.value === 'true')}
    >
      <option value="inherit">{t('catalog.rules.inherit', { value: effectiveValue ? t('common:yes') : t('common:no') })}</option>
      <option value="true">{t('common:yes')}</option>
      <option value="false">{t('common:no')}</option>
    </select>
  );
}

function collectDescendantIds(categoryId, flatCategories) {
  const ids = new Set();
  const stack = [categoryId];
  while (stack.length) {
    const current = stack.pop();
    for (const c of flatCategories) {
      if (String(c.parentId || '') === String(current) && !ids.has(c._id)) {
        ids.add(c._id);
        stack.push(c._id);
      }
    }
  }
  return ids;
}

export default function CategoryEditPanel({ detail, flatCategories, isPlatformOwner, onSaved, onDeleted }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { category, effective } = detail;
  const [tab, setTab] = useState('basics');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [nameEn, setNameEn] = useState(category.name.en);
  const [nameSi, setNameSi] = useState(category.name.si || '');
  const [nameTa, setNameTa] = useState(category.name.ta || '');
  const [slug, setSlug] = useState(category.slug);
  const [icon, setIcon] = useState(category.icon || '');
  const [parentId, setParentId] = useState(category.parentId ? String(category.parentId) : '');
  const [active, setActive] = useState(category.active);

  const [commissionPct, setCommissionPct] = useState(((category.commissionRateBps ?? 0) / 100).toString());
  const [returnable, setReturnable] = useState(category.returnPolicy?.returnable ?? null);
  const [windowDays, setWindowDays] = useState(category.returnPolicy?.windowDays ?? null);
  const [returnNoteEn, setReturnNoteEn] = useState(category.returnPolicy?.note?.en || '');
  const [returnNoteSi, setReturnNoteSi] = useState(category.returnPolicy?.note?.si || '');
  const [returnNoteTa, setReturnNoteTa] = useState(category.returnPolicy?.note?.ta || '');
  const [regulated, setRegulated] = useState(category.regulated ?? null);
  const [reviewRequired, setReviewRequired] = useState(category.reviewRequired ?? null);

  const [ownFields, setOwnFields] = useState(category.attributeSchema || []);
  const [keywords, setKeywords] = useState(category.prohibitedKeywords || []);

  const slugLocked = category.listingCount > 0;
  const excludedIds = collectDescendantIds(category._id, flatCategories);
  const parentOptions = flatCategories.filter((c) => c._id !== category._id && !excludedIds.has(c._id));

  const save = async () => {
    setSaving(true);
    const payload = {
      name: { en: nameEn.trim(), si: nameSi.trim(), ta: nameTa.trim() },
      slug: slug.trim(),
      parentId: parentId || null,
      icon: icon.trim(),
      active,
      returnPolicy: {
        returnable,
        windowDays: windowDays === '' ? null : windowDays,
        note: { en: returnNoteEn.trim(), si: returnNoteSi.trim(), ta: returnNoteTa.trim() },
      },
      prohibitedKeywords: keywords,
      attributeSchema: ownFields,
    };
    // Owner-only fields must be OMITTED (not just unchanged) for staff —
    // restrictFieldsToOwner middleware 403s on presence, not on diff.
    if (isPlatformOwner) {
      payload.commissionRateBps = Math.round(Number(commissionPct || 0) * 100);
      payload.regulated = regulated;
      payload.reviewRequired = reviewRequired;
    }
    try {
      const { data } = await updateCategory(category._id, payload);
      toast.success(t('catalog.saved'));
      onSaved(data.category);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setSaving(true);
    try {
      await deleteCategory(category._id);
      toast.success(t('catalog.deleted'));
      onDeleted(category._id);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>
        {TABS.map((key) => (
          <button key={key} className={tab === key ? 'btn-primary' : 'btn-secondary'} style={{ padding: '7px 14px', fontSize: '12px' }} onClick={() => setTab(key)}>
            {t(`catalog.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'basics' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}>
          <LabeledInput label={t('catalog.fields.labelEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <LabeledInput label={t('catalog.fields.labelSi')} value={nameSi} onChange={(e) => setNameSi(e.target.value)} />
          <LabeledInput label={t('catalog.fields.labelTa')} value={nameTa} onChange={(e) => setNameTa(e.target.value)} />
          <div>
            <LabeledInput label={t('catalog.basics.slug')} value={slug} onChange={(e) => setSlug(e.target.value)} disabled={slugLocked} />
            {slugLocked && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('catalog.basics.slugLocked')}</div>}
          </div>
          <LabeledInput label={t('catalog.basics.icon')} value={icon} onChange={(e) => setIcon(e.target.value)} hint={t('catalog.basics.iconHint')} />
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.basics.parent')}</label>
            <select className="select-field" style={{ marginTop: '6px' }} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">{t('catalog.basics.noParent')}</option>
              {parentOptions.map((c) => (
                <option key={c._id} value={c._id}>{'— '.repeat(c.depth)}{localized(c.name, i18n.language)}</option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t('catalog.basics.active')}
          </label>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.basics.depth', { depth: category.depth + 1 })}</div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}>
          {!isPlatformOwner && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.rules.ownerOnlyNote')}</div>}

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.rules.commission')}</label>
            <input
              type="number" min="0" max="50" step="0.01" className="input-field" style={{ marginTop: '6px' }}
              value={commissionPct} disabled={!isPlatformOwner} onChange={(e) => setCommissionPct(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.rules.returnable')}</label>
            <div style={{ marginTop: '6px' }}>
              <NullableBooleanSelect value={returnable} onChange={setReturnable} effectiveValue={effective.returnPolicy.returnable} t={t} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.rules.windowDays')}</label>
            <input
              type="number" min="0" className="input-field" style={{ marginTop: '6px' }}
              placeholder={t('catalog.rules.windowDaysInherit', { days: effective.returnPolicy.windowDays })}
              value={windowDays ?? ''}
              onChange={(e) => setWindowDays(e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
          <LabeledInput label={t('catalog.rules.noteEn')} value={returnNoteEn} onChange={(e) => setReturnNoteEn(e.target.value)} textarea />
          <LabeledInput label={t('catalog.rules.noteSi')} value={returnNoteSi} onChange={(e) => setReturnNoteSi(e.target.value)} textarea />
          <LabeledInput label={t('catalog.rules.noteTa')} value={returnNoteTa} onChange={(e) => setReturnNoteTa(e.target.value)} textarea />

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.rules.regulated')}</label>
            <div style={{ marginTop: '6px' }}>
              <NullableBooleanSelect value={regulated} onChange={setRegulated} disabled={!isPlatformOwner} effectiveValue={effective.regulated} t={t} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('catalog.rules.reviewRequired')}</label>
            <div style={{ marginTop: '6px' }}>
              <NullableBooleanSelect value={reviewRequired} onChange={setReviewRequired} disabled={!isPlatformOwner} effectiveValue={effective.reviewRequired} t={t} />
            </div>
          </div>
        </div>
      )}

      {tab === 'fields' && (
        <FieldsTab ownFields={ownFields} onChangeOwnFields={setOwnFields} effectiveFields={effective.attributeSchema} listingCount={category.listingCount} />
      )}

      {tab === 'keywords' && (
        <div className="glass-card" style={{ padding: '20px', maxWidth: '520px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>{t('catalog.keywords.label')}</label>
          <TagInput value={keywords} onChange={setKeywords} placeholder={t('catalog.keywords.placeholder')} />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>{t('catalog.keywords.hint')}</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button
          className="btn-danger"
          disabled={category.listingCount > 0 || saving}
          title={category.listingCount > 0 ? t('catalog.basics.deleteBlocked') : undefined}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 size={14} /> {t('catalog.basics.delete')}
        </button>
        <button className="btn-primary" disabled={saving || !nameEn.trim() || !slug.trim()} onClick={save}>{t('common:save')}</button>
      </div>

      {confirmingDelete && (
        <div className="modal-overlay" onClick={() => setConfirmingDelete(false)}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('catalog.basics.deleteConfirmTitle')}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{t('catalog.basics.deleteConfirmBody')}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setConfirmingDelete(false)}>{t('common:cancel')}</button>
              <button className="btn-danger" disabled={saving} onClick={confirmDelete}>{t('catalog.basics.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange, disabled, hint, textarea }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</label>
      {textarea ? (
        <textarea className="input-field" style={{ marginTop: '6px', minHeight: '60px' }} value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <input className="input-field" style={{ marginTop: '6px' }} value={value} onChange={onChange} disabled={disabled} />
      )}
      {hint && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}
