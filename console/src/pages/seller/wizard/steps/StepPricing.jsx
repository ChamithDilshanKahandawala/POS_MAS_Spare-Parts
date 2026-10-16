import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCommissionPreview } from '../../../../api/services';

function centsToRs(cents) {
  return cents ? (cents / 100).toString() : '';
}

export default function StepPricing({ listing, onChange }) {
  const { t } = useTranslation(['seller', 'common']);
  const [commission, setCommission] = useState(null);
  const categoryId = listing.categoryId?._id || listing.categoryId;

  useEffect(() => {
    if (!categoryId || !listing.priceCents) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCommission(null);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      getCommissionPreview(categoryId, listing.priceCents).then(({ data }) => { if (active) setCommission(data); }).catch(() => {});
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [categoryId, listing.priceCents]);

  const rsField = (field) => ({
    value: centsToRs(listing[field]),
    onChange: (e) => onChange({ [field]: e.target.value === '' ? (field === 'wasPriceCents' ? null : 0) : Math.round(Number(e.target.value) * 100) }),
  });

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.pricing.price')}</label>
          <input type="number" min="0" step="0.01" className="input-field" style={{ marginTop: '6px' }} {...rsField('priceCents')} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.pricing.wasPrice')}</label>
          <input type="number" min="0" step="0.01" className="input-field" style={{ marginTop: '6px' }} {...rsField('wasPriceCents')} />
        </div>
      </div>

      {commission && (
        <div className="badge badge-green" style={{ alignSelf: 'flex-start', padding: '8px 14px', fontSize: '13px' }}>
          {t('wizard.pricing.youReceive', { amount: (commission.youReceiveCents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.pricing.stock')}</label>
          <input type="number" min="0" className="input-field" style={{ marginTop: '6px' }} value={listing.stock ?? 0} onChange={(e) => onChange({ stock: Number(e.target.value) })} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.pricing.lowStockAlert')}</label>
          <input type="number" min="0" className="input-field" style={{ marginTop: '6px' }} value={listing.lowStockAlert ?? ''} onChange={(e) => onChange({ lowStockAlert: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.pricing.weight')}</label>
          <input type="number" min="0" className="input-field" style={{ marginTop: '6px' }} value={listing.weightGrams ?? 0} onChange={(e) => onChange({ weightGrams: Number(e.target.value) })} />
        </div>
      </div>

      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('wizard.pricing.dimensions')}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
          {['l', 'w', 'h'].map((dim) => (
            <input
              key={dim} type="number" min="0" className="input-field" placeholder={t(`wizard.pricing.dim${dim.toUpperCase()}`)}
              value={listing.dimensions?.[dim] ?? ''}
              onChange={(e) => onChange({ dimensions: { ...listing.dimensions, [dim]: e.target.value === '' ? null : Number(e.target.value) } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
