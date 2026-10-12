import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SHOP_INFO } from '../config/store';
import useDocumentMeta from '../hooks/useDocumentMeta';

// Draft — to be reviewed before this is treated as the shop's real,
// binding terms of sale. See translations/review-sheet.csv for the si/ta
// draft status.
const SECTION_ORDER = ['prices', 'stock', 'confirmation', 'delivery', 'returns', 'law'];

export default function TermsPage() {
  const { t } = useTranslation('terms');
  useDocumentMeta(`${t('metaTitle')} | ${SHOP_INFO.name}`, t('metaDescription'));

  return (
    <div className="animate-fade" style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <h1 className="page-title">{t('heading')}</h1>
      </div>
      <p style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '28px' }}>
        {t('lastUpdated')}
      </p>

      {SECTION_ORDER.map((key) => (
        <div key={key} className="glass-card" style={{ padding: '24px 28px', borderRadius: '18px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
            {t(`sections.${key}.heading`)}
          </h2>
          <div style={{ fontSize: '13.5px', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
            {key === 'delivery' ? (
              <Trans i18nKey="terms:sections.delivery.body" components={[<Link key="0" to="/delivery" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />]} />
            ) : key === 'returns' ? (
              <Trans i18nKey="terms:sections.returns.body" components={[<Link key="0" to="/returns" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />]} />
            ) : (
              t(`sections.${key}.body`)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
