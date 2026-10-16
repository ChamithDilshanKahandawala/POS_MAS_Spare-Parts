import { useTranslation } from 'react-i18next';

const WARRANTY_TYPES = ['none', 'days', 'months'];

export default function StepReturns({ listing, effective, onChange }) {
  const { t } = useTranslation(['seller', 'common']);
  const returnPolicy = effective?.returnPolicy;
  const minMonths = effective?.warrantyRule?.minMonths || 0;
  const warranty = listing.warranty || { type: 'none', value: 0 };

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>{t('wizard.returns.categoryRule')}</h4>
        {returnPolicy?.returnable ? (
          <span className="badge badge-blue">{t('wizard.returns.returnableDays', { days: returnPolicy.windowDays })}</span>
        ) : (
          <span className="badge badge-orange">{t('wizard.returns.notReturnable')}</span>
        )}
        {returnPolicy?.note?.en && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>{returnPolicy.note.en}</p>}
      </div>

      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.returns.warrantyType')}</label>
        <select className="select-field" style={{ marginTop: '6px' }} value={warranty.type} onChange={(e) => onChange({ warranty: { ...warranty, type: e.target.value } })}>
          {WARRANTY_TYPES.map((wt) => <option key={wt} value={wt}>{t(`wizard.returns.warrantyTypes.${wt}`)}</option>)}
        </select>
      </div>
      {warranty.type !== 'none' && (
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t(`wizard.returns.warrantyValue.${warranty.type}`)}</label>
          <input
            type="number" min="0" className="input-field" style={{ marginTop: '6px', maxWidth: '160px' }}
            value={warranty.value ?? 0}
            onChange={(e) => onChange({ warranty: { ...warranty, value: Number(e.target.value) } })}
          />
        </div>
      )}
      {minMonths > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.returns.minWarrantyHint', { months: minMonths })}</div>
      )}
    </div>
  );
}
