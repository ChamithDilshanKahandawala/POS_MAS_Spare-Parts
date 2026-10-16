import { useTranslation } from 'react-i18next';
import RichTextArea from '../RichTextArea';

const CONDITIONS = ['new', 'used', 'reconditioned'];

export default function StepBasics({ listing, onChange }) {
  const { t } = useTranslation(['seller', 'common']);

  const setLocalized = (field, lang) => (e) => onChange({ [field]: { ...listing[field], [lang]: e.target.value } });
  const setDescription = (lang) => (text) => onChange({ description: { ...listing.description, [lang]: text } });

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.basics.titleEn')}</label>
        <input className="input-field" style={{ marginTop: '6px' }} value={listing.title?.en || ''} onChange={setLocalized('title', 'en')} maxLength={120} />
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('wizard.basics.titleHint')}</div>
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.basics.titleSi')}</label>
        <input className="input-field" style={{ marginTop: '6px' }} value={listing.title?.si || ''} onChange={setLocalized('title', 'si')} maxLength={120} />
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.basics.titleTa')}</label>
        <input className="input-field" style={{ marginTop: '6px' }} value={listing.title?.ta || ''} onChange={setLocalized('title', 'ta')} maxLength={120} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.basics.brand')}</label>
          <input className="input-field" style={{ marginTop: '6px' }} value={listing.brand || ''} onChange={(e) => onChange({ brand: e.target.value })} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.basics.condition')}</label>
          <select className="select-field" style={{ marginTop: '6px' }} value={listing.condition || 'new'} onChange={(e) => onChange({ condition: e.target.value })}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{t(`wizard.basics.conditions.${c}`)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.basics.sku')}</label>
          <input className="input-field" style={{ marginTop: '6px' }} value={listing.sku || ''} onChange={(e) => onChange({ sku: e.target.value })} />
        </div>
      </div>

      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{t('wizard.basics.descriptionEn')}</label>
        <RichTextArea value={listing.description?.en || ''} onChange={setDescription('en')} placeholder={t('wizard.basics.descriptionHint')} />
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{t('wizard.basics.descriptionSi')}</label>
        <RichTextArea value={listing.description?.si || ''} onChange={setDescription('si')} rows={3} />
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{t('wizard.basics.descriptionTa')}</label>
        <RichTextArea value={listing.description?.ta || ''} onChange={setDescription('ta')} rows={3} />
      </div>
    </div>
  );
}
