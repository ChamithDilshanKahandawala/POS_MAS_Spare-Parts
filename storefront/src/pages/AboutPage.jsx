import { useTranslation } from 'react-i18next';
import { ShieldCheck, Truck, Banknote, MessageCircle } from 'lucide-react';
import { SHOP_INFO, CATEGORIES } from '../config/store';
import useDocumentMeta from '../hooks/useDocumentMeta';

const WHY_US_ICONS = [ShieldCheck, Truck, Banknote, MessageCircle];

export default function AboutPage() {
  const { t } = useTranslation('about');
  useDocumentMeta(`${t('metaTitle')} | ${SHOP_INFO.name}`, t('metaDescription'));

  const storyParagraphs = t('story.paragraphs', { returnObjects: true });
  const whyUsItems = t('whyUs.items', { returnObjects: true });

  return (
    <div className="animate-fade" style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 className="page-title">{t('hero.heading')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>{t('hero.subtitle')}</p>
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
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>{t('whatWeSell.intro')}</p>
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
