import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Store, MapPin, BadgeCheck, ChevronRight } from 'lucide-react';

// Shown near the price on the product detail page — the one place a
// customer decides "who am I actually buying this from". `seller` is a
// SELLERS entry from src/config/store.js (every product resolves to the
// same one today via getSellerForProduct(), but this component itself
// doesn't know or care — it just renders whatever seller it's handed).
export default function SellerCard({ seller }) {
  const { t } = useTranslation('platform');

  return (
    <Link
      to={`/store/${seller.slug}`}
      className="glass-card"
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
        borderRadius: '16px', marginBottom: '20px', textDecoration: 'none',
      }}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
        background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Store size={19} color="var(--accent-primary)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {seller.name}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700,
            color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 7px', borderRadius: '999px',
            minWidth: 0, maxWidth: '100%',
          }}>
            <BadgeCheck size={11} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('verifiedSeller')}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          <MapPin size={11} /> {t('store.location')}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12.5px', fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0 }}>
        {t('visitStore')} <ChevronRight size={14} />
      </div>
    </Link>
  );
}
