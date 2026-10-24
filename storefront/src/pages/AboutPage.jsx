import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Truck, Banknote, MessageCircle, ChevronRight } from 'lucide-react';
import { SHOP_INFO, PLATFORM_INFO, CATEGORIES, getSellerForProduct } from '../config/store';
import { isMarketplace } from '../api/dataSource';
import useDocumentMeta from '../hooks/useDocumentMeta';

const WHY_US_ICONS = [ShieldCheck, Truck, Banknote, MessageCircle];

// Follow-up — "genuine parts"/"genuine vehicle spare parts" in platform:
// aboutApexoraSubtitle/Body are the same unverifiable-guarantee pattern
// already softened in footer.jsx's footerTagline; marketplace:about.*
// below replaces them in marketplace mode only. pos mode's AboutPage
// still reads the originals unchanged.
export default function AboutPage() {
  const { t } = useTranslation(['about', 'platform', 'marketplace']);
  const aboutSubtitle = isMarketplace ? t('marketplace:about.subtitle') : t('platform:aboutApexoraSubtitle');
  const aboutBody = isMarketplace ? t('marketplace:about.body') : t('platform:aboutApexoraBody');
  // Follow-up #2 — about:whatWeSell.intro ("Genuine, quality-checked spare
  // parts...") is the same unverifiable-guarantee pattern fixed above;
  // marketplace:about.intro replaces it in marketplace mode only.
  const whatWeSellIntro = isMarketplace ? t('marketplace:about.intro') : t('whatWeSell.intro');
  useDocumentMeta(`${t('platform:aboutApexoraHeading')} | ${PLATFORM_INFO.name}`, aboutBody);

  const seller = getSellerForProduct();
  const storyParagraphs = t('story.paragraphs', { returnObjects: true });
  const whyUsItems = t('whyUs.items', { returnObjects: true });

  return (
    <div className="animate-fade" style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* ── About Apexora (the platform) ── */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">{t('platform:aboutApexoraHeading')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>{aboutSubtitle}</p>
      </div>
      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '40px' }}>
        <p style={{ fontSize: '14px', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
          {aboutBody}
        </p>
      </div>

      {/* ── Our first store (the seller) ── */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 className="page-title" style={{ fontSize: '26px' }}>{t('platform:firstStoreHeading', { seller: seller.name })}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>{t('hero.subtitle')}</p>
        <Link
          to={`/store/${seller.slug}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '10px', fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none' }}
        >
          {t('platform:visitStore')} <ChevronRight size={14} />
        </Link>
      </div>

      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>{t('story.heading')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {storyParagraphs.map((p, i) => {
            const isPlaceholder = p.startsWith('PLACEHOLDER');
            return (
              <p key={i} style={{
                fontSize: '14px', lineHeight: 1.75,
                color: isPlaceholder ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontStyle: isPlaceholder ? 'italic' : 'normal',
                padding: isPlaceholder ? '12px 14px' : 0,
                background: isPlaceholder ? 'var(--bg-secondary)' : 'transparent',
                borderRadius: isPlaceholder ? '10px' : 0,
                border: isPlaceholder ? '1px dashed var(--border)' : 'none',
              }}>
                {p}
              </p>
            );
          })}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>{t('whatWeSell.heading')}</h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>{whatWeSellIntro}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {CATEGORIES.map((c) => (
            <span key={c} style={{
              fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)',
              background: 'var(--accent-light)', padding: '6px 14px', borderRadius: '999px',
            }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '18px' }}>{t('whyUs.heading')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {whyUsItems.map((item, i) => {
            const Icon = WHY_US_ICONS[i] || ShieldCheck;
            return (
              <div key={item.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={17} color="var(--accent-primary)" />
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{item.title}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>{t('details.heading')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t('details.addressLabel')}: </span>
            {SHOP_INFO.addressLines.join(', ')}, {SHOP_INFO.district}, {SHOP_INFO.country}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t('details.brLabel')}: </span>
            {SHOP_INFO.brNumber}
          </div>
        </div>
      </div>
    </div>
  );
}
