import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Facebook, Instagram, Youtube, MessageCircle,
  Mail, Phone, MapPin, Clock,
  ShieldCheck, Truck, RotateCcw, Star, Zap,
  ChevronRight, Send,
} from 'lucide-react';

import { SHOP_INFO, PAYMENT_BADGES, formatPhoneDisplay } from '../../config/store';
import { slugify } from '../../utils/slugify';

export default function Footer() {
  const { t } = useTranslation('footer');
  const [email, setEmail]       = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 4000);
  };

  const year = new Date().getFullYear();

  /* ─── data ─────────────────────────────────────────────── */
  const trustBadges = [
    { icon: <ShieldCheck size={18} />, label: t('trust.securePayments'),      color: '#10b981' },
    { icon: <Truck size={18} />,       label: t('trust.islandwideDelivery'),  color: '#e67e22' },
    { icon: <RotateCcw size={18} />,   label: t('trust.easyReturns'),         color: '#f59e0b' },
    { icon: <Star size={18} />,        label: t('trust.genuineParts'),        color: '#ec4899' },
    { icon: <Zap size={18} />,         label: t('trust.fastProcessing'),      color: '#14b8a6' },
  ];

  const quickLinks = [
    // Previously pointed at /?category=... — StorefrontPage never read that
    // query param, so these were dead links. Now point at the real category
    // pages (see CategoryPage.jsx).
    { label: t('quickShop.threeWheelParts'), to: `/category/${slugify('Three-Wheel')}` },
    { label: t('quickShop.bikeSpareParts'),  to: `/category/${slugify('Bike')}`        },
    { label: t('quickShop.carAccessories'),  to: `/category/${slugify('Car')}`         },
    { label: t('quickShop.vanSuvParts'),     to: `/category/${slugify('SUV')}`         },
    { label: t('quickShop.trackMyOrder'),    to: '/orders'                            },
  ];

  const supportLinks = [
    { label: t('support.aboutUs'),               to: '/about' },
    { label: t('support.contactUs'),             to: '/contact' },
    { label: t('support.deliveryInformation'),   to: '/delivery' },
    { label: t('support.returnRefundPolicy'),    to: '/returns' },
    { label: t('support.privacyPolicy'),         to: '/privacy' },
    { label: t('support.termsConditions'),       to: '/terms' },
  ];

  const socials = [
    { icon: <Facebook size={17} />,      label: 'Facebook',  href: '#',                                 color: '#1877f2' },
    { icon: <Instagram size={17} />,     label: 'Instagram', href: '#',                                 color: '#e1306c' },
    { icon: <Youtube size={17} />,       label: 'YouTube',   href: '#',                                 color: '#ff0000' },
    { icon: <MessageCircle size={17} />, label: 'WhatsApp',  href: `https://wa.me/${SHOP_INFO.whatsapp}`, color: '#25d366' },
  ];

  const contactItems = [
    { icon: <MapPin size={14} />, text: `${SHOP_INFO.addressLines.join(', ')}, ${SHOP_INFO.district}, ${SHOP_INFO.country}`, color: '#e67e22' },
    ...SHOP_INFO.phones.map((phone) => ({ icon: <Phone size={14} />, text: formatPhoneDisplay(phone), color: '#10b981', href: `tel:${phone}` })),
    { icon: <Mail size={14} />, text: SHOP_INFO.email, color: '#f59e0b', href: `mailto:${SHOP_INFO.email}` },
    { icon: <Clock size={14} />, text: t('contact.hours'), color: '#ec4899' },
  ];

  /* ─── shared style helpers ──────────────────────────────── */
  const sectionHeading = (accentColor) => ({
    fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)',
    textTransform: 'uppercase', letterSpacing: '1.8px', marginBottom: '24px',
    paddingBottom: '10px', borderBottom: `2px solid ${accentColor}`,
    display: 'inline-block',
  });

  const navLink = { base: {
    display: 'flex', alignItems: 'center', gap: '8px',
    color: 'var(--text-muted)', textDecoration: 'none',
    fontSize: '13.5px', marginBottom: '10px', fontWeight: 500,
    transition: 'all 0.18s ease',
  }};

  /* ─── render ────────────────────────────────────────────── */
  return (
    <footer style={{ marginTop: '80px' }}>

      {/* Rainbow top border */}
      <div style={{
        height: '3px',
        background: 'linear-gradient(90deg,#e67e22,#f39c12,#d35400,#e67e22,#f39c12,#d35400,#e67e22)',
        backgroundSize: '200% 100%',
        animation: 'mas-footer-shine 5s linear infinite',
      }} />

      {/* ── Trust badge strip ── */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '16px 32px',
          display: 'flex', justifyContent: 'space-around',
          alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        }}>
          {trustBadges.map((b) => (
            <div key={b.label} style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)',
            }}>
              <span style={{ color: b.color, display: 'flex' }}>{b.icon}</span>
              {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main body ── */}
      <div style={{
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-light)',
        padding: '60px 32px 40px',
      }}>
        <div className="mas-footer-grid" style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1.6fr',
          gap: '48px',
        }}>

          {/* ── Brand column ── */}
          <div>
            {/* Logo mark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
                background: 'linear-gradient(135deg,#e67e22,#d35400)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(230,126,34,0.4)',
              }}>
                <span style={{ fontSize: '20px' }}>🏎️</span>
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  MUDIYANSE
                </div>
                <div style={{ fontSize: '9px', color: '#e67e22', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase' }}>
                  Auto Solutions
                </div>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.75, marginBottom: '20px', maxWidth: '290px' }}>
              {t('brand.description')}
            </p>

            {/* Stars */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '8px 14px', marginBottom: '22px',
              background: 'rgba(251,191,36,0.08)', borderRadius: '10px',
              border: '1px solid rgba(251,191,36,0.2)',
            }}>
              {[0,1,2,3,4].map(i => <Star key={i} size={13} fill="#fbbf24" color="#fbbf24" />)}
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', marginLeft: '3px' }}>4.9</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: '2px' }}>{t('brand.reviews')}</span>
            </div>

            {/* Socials */}
            <div style={{ display: 'flex', gap: '9px' }}>
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank" rel="noreferrer"
                  title={s.label}
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)', textDecoration: 'none',
                    transition: 'all 0.22s ease',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.background = s.color;
                    el.style.color = 'white';
                    el.style.borderColor = s.color;
                    el.style.transform = 'translateY(-3px)';
                    el.style.boxShadow = `0 6px 18px ${s.color}44`;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.background = 'var(--bg-secondary)';
                    el.style.color = 'var(--text-muted)';
                    el.style.borderColor = 'var(--border-light)';
                    el.style.transform = 'translateY(0)';
                    el.style.boxShadow = 'none';
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* ── Quick Shop ── */}
          <div>
            <h4 style={sectionHeading('#e67e22')}>{t('quickShop.heading')}</h4>
            {quickLinks.map((l) => (
              <Link
                key={l.label} to={l.to}
                style={navLink.base}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#e67e22';
                  e.currentTarget.style.paddingLeft = '5px';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.paddingLeft = '0';
                }}
              >
                <ChevronRight size={13} style={{ color: '#e67e22', flexShrink: 0 }} />
                {l.label}
              </Link>
            ))}
          </div>

          {/* ── Support ── */}
          <div>
            <h4 style={sectionHeading('#8b5cf6')}>{t('support.heading')}</h4>
            {supportLinks.map((l) => (
              <Link
                key={l.label} to={l.to}
                style={navLink.base}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#8b5cf6';
                  e.currentTarget.style.paddingLeft = '5px';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.paddingLeft = '0';
                }}
              >
                <ChevronRight size={13} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                {l.label}
              </Link>
            ))}
          </div>

          {/* ── Contact + Newsletter ── */}
          <div>
            <h4 style={sectionHeading('#10b981')}>{t('contact.heading')}</h4>

            {/* Contact list */}
            <div style={{ marginBottom: '22px' }}>
              {contactItems.map((c) => {
                const Tag = c.href ? 'a' : 'div';
                return (
                  <Tag key={c.text} href={c.href} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    marginBottom: '10px', fontSize: '13px', color: 'var(--text-muted)',
                    textDecoration: 'none',
                  }}>
                    <span style={{ color: c.color, flexShrink: 0, marginTop: '1px', display: 'flex' }}>{c.icon}</span>
                    {c.text}
                  </Tag>
                );
              })}
            </div>

            {/* WhatsApp CTA */}
            <a
              href={`https://wa.me/${SHOP_INFO.whatsapp}`}
              target="_blank" rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                background: '#25d366', color: 'white', textDecoration: 'none',
                padding: '11px 18px', borderRadius: '12px',
                fontSize: '13px', fontWeight: 700, marginBottom: '20px',
                boxShadow: '0 4px 14px rgba(37,211,102,0.28)',
                transition: 'all 0.22s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,211,102,0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,211,102,0.28)';
              }}
            >
              <MessageCircle size={17} />
              {t('contact.chatOnWhatsapp')}
            </a>

            {/* Newsletter box */}
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: '14px',
              padding: '16px', border: '1px solid var(--border-light)',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                {t('newsletter.title')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {t('newsletter.subtitle')}
              </div>
              {subscribed ? (
                <div style={{
                  padding: '9px', borderRadius: '10px', textAlign: 'center',
                  background: 'rgba(16,185,129,0.1)', color: '#10b981',
                  fontSize: '13px', fontWeight: 600,
                }}>
                  {t('newsletter.subscribed')}
                </div>
              ) : (
                <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '7px' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('newsletter.placeholder')}
                    className="input-field"
                    style={{ flex: 1, fontSize: '12.5px', padding: '9px 12px', borderRadius: '9px' }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg,#e67e22,#d35400)',
                      color: 'white', border: 'none', borderRadius: '9px',
                      padding: '9px 13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'opacity 0.18s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.82'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <Send size={14} />
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-light)',
        padding: '16px 32px',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '10px',
        }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              © {year}{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>{SHOP_INFO.name}</strong>
              {'. '}{t('bottomBar.rights')}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {t('bottomBar.brNumber', { brNumber: SHOP_INFO.brNumber })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {PAYMENT_BADGES.map((pm) => (
              <span key={pm.code} style={{
                fontSize: '10px', fontWeight: 800, letterSpacing: '0.4px',
                padding: '3px 8px', borderRadius: '6px',
                border: '1px solid var(--border-light)',
                color: 'var(--text-muted)', background: 'var(--bg-card)',
              }}>
                {t(pm.labelKey)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* keyframe + responsive grid */}
      <style>{`
        @keyframes mas-footer-shine {
          0%   { background-position: 0%   50%; }
          100% { background-position: 200% 50%; }
        }
        /* The 4-column grid's "fr" tracks each have an implicit min-width
           equal to their own content's min-content size, not 0 — so long
           unbreakable content (the phone/email line, the newsletter
           input+button row) in the narrow "Get In Touch" column was forcing
           the whole grid wider than the viewport at narrow widths, causing
           a site-wide horizontal scroll (every page renders this footer).
           Stacking removes the competing fr-shrink entirely instead of
           trying to out-narrow the content. Desktop (≥1024px) is untouched. */
        @media (max-width: 1023px) {
          .mas-footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .mas-footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}