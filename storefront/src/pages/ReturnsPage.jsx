import { useTranslation } from 'react-i18next';
import { PackageCheck, Zap, Camera, Package, Banknote, MessageCircle } from 'lucide-react';
import { SHOP_INFO, RETURN_WINDOW_DAYS } from '../config/store';
import useDocumentMeta from '../hooks/useDocumentMeta';

// si/ta copy is a draft — have a native speaker review it before launch.
const POINT_ICONS = { electronics: Zap, otherProblems: Camera, condition: Package, refundMethod: Banknote };

export default function ReturnsPage() {
  const { t } = useTranslation('returns');
  useDocumentMeta(`${t('metaTitle')} | ${SHOP_INFO.name}`, t('metaDescription'));

  const whatsappHref = `https://wa.me/${SHOP_INFO.whatsapp}?text=${encodeURIComponent(t('cta'))}`;
  const pointKeys = ['electronics', 'otherProblems', 'condition', 'refundMethod'];

  return (
    <div className="animate-fade" style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 className="page-title">{t('heading')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>{t('subtitle')}</p>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 600,
        color: 'var(--accent-primary)', background: 'var(--accent-light)', padding: '14px 18px',
        borderRadius: '14px', marginBottom: '20px',
      }}>
        <PackageCheck size={18} /> {t('intro')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
        {pointKeys.map((key) => {
          const Icon = POINT_ICONS[key];
          return (
            <div key={key} className="glass-card" style={{ padding: '22px 24px', borderRadius: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Icon size={17} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>{t(`points.${key}.heading`)}</h2>
              </div>
              <p style={{
                fontSize: '13.5px', lineHeight: 1.7,
                color: 'var(--text-secondary)',
              }}>
                {key === 'otherProblems' ? t(`points.${key}.body`, { days: RETURN_WINDOW_DAYS }) : t(`points.${key}.body`)}
              </p>
            </div>
          );
        })}
      </div>

      <a
        href={whatsappHref} target="_blank" rel="noopener noreferrer"
        className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', textDecoration: 'none' }}
      >
        <MessageCircle size={16} /> {t('cta')}
      </a>
    </div>
  );
}
