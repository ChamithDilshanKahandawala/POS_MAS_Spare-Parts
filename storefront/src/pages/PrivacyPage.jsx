import { useTranslation } from 'react-i18next';
import { SHOP_INFO, PLATFORM_INFO } from '../config/store';
import useDocumentMeta from '../hooks/useDocumentMeta';

// Draft — to be reviewed before this is treated as the shop's real,
// binding privacy policy. See translations/review-sheet.csv for the si/ta
// draft status.
function Section({ heading, children }) {
  return (
    <div className="glass-card" style={{ padding: '24px 28px', borderRadius: '18px', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>{heading}</h2>
      <div style={{ fontSize: '13.5px', lineHeight: 1.75, color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{ margin: '10px 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export default function PrivacyPage() {
  const { t } = useTranslation('privacy');
  useDocumentMeta(`${t('metaTitle')} | ${PLATFORM_INFO.name}`, t('metaDescription'));

  const whatWeCollectItems = t('sections.whatWeCollect.items', { returnObjects: true });
  const whyWeCollectItems = t('sections.whyWeCollect.items', { returnObjects: true });
  const whoWeShareItems = t('sections.whoWeShareWith.items', { returnObjects: true });

  return (
    <div className="animate-fade" style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <h1 className="page-title">{t('heading')}</h1>
      </div>
      <p style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '28px' }}>
        {t('lastUpdated')}
      </p>

      <Section heading={t('sections.whoWeAre.heading')}>
        {t('sections.whoWeAre.body', { platform: PLATFORM_INFO.name, name: SHOP_INFO.name, brNumber: SHOP_INFO.brNumber })}
      </Section>

      <Section heading={t('sections.whatWeCollect.heading')}>
        {t('sections.whatWeCollect.intro')}
        <BulletList items={whatWeCollectItems} />
      </Section>

      <Section heading={t('sections.whyWeCollect.heading')}>
        {t('sections.whyWeCollect.intro')}
        <BulletList items={whyWeCollectItems} />
      </Section>

      <Section heading={t('sections.whoWeShareWith.heading')}>
        {t('sections.whoWeShareWith.intro')}
        <BulletList items={whoWeShareItems} />
        <p style={{ marginTop: '10px' }}>{t('sections.whoWeShareWith.outro')}</p>
      </Section>

      <Section heading={t('sections.howLong.heading')}>
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('sections.howLong.body')}</span>
      </Section>

      <Section heading={t('sections.security.heading')}>
        {t('sections.security.body')}
      </Section>

      <Section heading={t('sections.yourChoices.heading')}>
        {t('sections.yourChoices.body', { email: SHOP_INFO.email })}
      </Section>

      <Section heading={t('sections.contact.heading')}>
        {t('sections.contact.body', { email: SHOP_INFO.email })}
      </Section>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'center', marginTop: '20px' }}>
        {t('legalNote')}
      </p>
    </div>
  );
}
