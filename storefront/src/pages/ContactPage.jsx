import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, MessageCircle, Mail, MapPin, Clock, ExternalLink } from 'lucide-react';
import { SHOP_INFO, formatPhoneDisplay } from '../config/store';
import { isShopOpenNow } from '../utils/openStatus';
import useDocumentMeta from '../hooks/useDocumentMeta';
import useJsonLd from '../hooks/useJsonLd';
import { buildShopJsonLd } from '../utils/shopJsonLd';

export default function ContactPage() {
  const { t } = useTranslation('contact');
  useDocumentMeta(`${t('metaTitle')} | ${SHOP_INFO.name}`, t('metaDescription'));
  useJsonLd(buildShopJsonLd());

  // Re-evaluated every 30s so the badge flips live across the open/close
  // boundary without needing a page refresh.
  const [isOpen, setIsOpen] = useState(() => isShopOpenNow(SHOP_INFO.hours));
  useEffect(() => {
    const id = setInterval(() => setIsOpen(isShopOpenNow(SHOP_INFO.hours)), 30000);
    return () => clearInterval(id);
  }, []);

  const fullAddress = `${SHOP_INFO.addressLines.join(', ')}, ${SHOP_INFO.district}, ${SHOP_INFO.country}`;
  const whatsappHref = `https://wa.me/${SHOP_INFO.whatsapp}`;
  const mapEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(SHOP_INFO.mapsEmbedQuery)}&output=embed`;

  const cardStyle = { padding: '24px', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '14px' };
  const iconWrap = (color) => ({
    width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
    background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div className="animate-fade" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 className="page-title">{t('heading')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>{t('subtitle')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '18px' }}>
        {/* Call */}
        <div className="glass-card" style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={iconWrap('#10b981')}><Phone size={18} color="#10b981" /></div>
            <h2 style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('callUs')}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SHOP_INFO.phones.map((phone) => (
              <a
                key={phone} href={`tel:${phone}`} aria-label={t('callLabel', { phone: formatPhoneDisplay(phone) })}
                className="btn-secondary" style={{ justifyContent: 'center', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}
              >
                <Phone size={14} /> {formatPhoneDisplay(phone)}
              </a>
            ))}
          </div>
        </div>

        {/* WhatsApp (primary) */}
        <div className="glass-card" style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={iconWrap('#25d366')}><MessageCircle size={18} color="#25d366" /></div>
            <h2 style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('whatsapp')}</h2>
          </div>
          <a
            href={whatsappHref} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
              background: '#25d366', color: 'white', textDecoration: 'none',
              padding: '11px 18px', borderRadius: '12px', fontSize: '13.5px', fontWeight: 700,
            }}
          >
            <MessageCircle size={16} /> {t('whatsapp')}
          </a>
        </div>

        {/* Email */}
        <div className="glass-card" style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={iconWrap('#f59e0b')}><Mail size={18} color="#f59e0b" /></div>
            <h2 style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('emailUs')}</h2>
          </div>
          <a href={`mailto:${SHOP_INFO.email}`} className="btn-secondary" style={{ justifyContent: 'center', textDecoration: 'none', wordBreak: 'break-all' }}>
            <Mail size={14} /> {SHOP_INFO.email}
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
        {/* Address + hours */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
            <div style={iconWrap('#e67e22')}><MapPin size={18} color="#e67e22" /></div>
            <div>
              <h2 style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{t('address')}</h2>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{fullAddress}</p>
              <a
                href={SHOP_INFO.mapsUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none', marginTop: '8px' }}
              >
                {t('openInMaps')} <ExternalLink size={12} />
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
            <div style={iconWrap('#2980b9')}><Clock size={18} color="#2980b9" /></div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('hours')}</h2>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                  color: isOpen ? '#10b981' : '#e74c3c',
                  background: isOpen ? 'rgba(16,185,129,0.12)' : 'rgba(231,76,60,0.12)',
                }}>
                  {isOpen ? t('openNow') : t('closedNow')}
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>{t('hoursValue')}</p>
            </div>
          </div>
        </div>

        {/* Map embed — fixed height reserved up front so the iframe loading
            in causes zero layout shift. */}
        <div className="glass-card" style={{ padding: '12px', borderRadius: '18px', overflow: 'hidden' }}>
          <iframe
            title={t('mapTitle', { name: SHOP_INFO.name })}
            src={mapEmbedSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ width: '100%', height: '260px', border: 0, borderRadius: '12px', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}
