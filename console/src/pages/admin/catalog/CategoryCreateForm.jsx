import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { createCategory } from '../../../api/services';
import { localized } from '../../../utils/localized';

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// The minimal form for a brand-new category — just enough to create it
// (Basics). Commission/regulated/reviewRequired are never sent here, so
// platform staff can create categories too; the Rules tab (owner-only
// fields) only appears once the category exists and is being edited.
export default function CategoryCreateForm({ parentId, parentName, onCreated, onCancel }) {
  const { t } = useTranslation(['admin', 'common']);
  const [nameEn, setNameEn] = useState('');
  const [nameSi, setNameSi] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);

  const handleNameEnChange = (v) => {
    setNameEn(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const submit = async () => {
    if (!nameEn.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      const { data } = await createCategory({
        name: { en: nameEn.trim(), si: nameSi.trim(), ta: nameTa.trim() },
        slug: slug.trim(),
        parentId: parentId || null,
        icon: icon.trim(),
      });
      toast.success(t('catalog.create.created'));
      onCreated(data.category);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '20px', maxWidth: '480px' }}>
      <h3 style={{ fontWeight: 700, marginBottom: '4px' }}>{t('catalog.create.title')}</h3>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        {parentId ? t('catalog.create.underParent', { parent: localized(parentName, 'en') || parentName }) : t('catalog.create.atRoot')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Field label={t('catalog.fields.labelEn')} value={nameEn} onChange={(e) => handleNameEnChange(e.target.value)} />
        <Field label={t('catalog.fields.labelSi')} value={nameSi} onChange={(e) => setNameSi(e.target.value)} />
        <Field label={t('catalog.fields.labelTa')} value={nameTa} onChange={(e) => setNameTa(e.target.value)} />
        <Field
          label={t('catalog.basics.slug')}
          value={slug}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
          hint={t('catalog.basics.slugHint')}
        />
        <Field label={t('catalog.basics.icon')} value={icon} onChange={(e) => setIcon(e.target.value)} hint={t('catalog.basics.iconHint')} />
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button className="btn-secondary" onClick={onCancel}>{t('common:cancel')}</button>
        <button className="btn-primary" disabled={!nameEn.trim() || !slug.trim() || saving} onClick={submit}>{t('common:save')}</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, hint }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</label>
      <input className="input-field" style={{ marginTop: '6px' }} value={value} onChange={onChange} />
      {hint && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}
