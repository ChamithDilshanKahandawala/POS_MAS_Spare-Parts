import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Facebook, Instagram, Youtube, MessageCircle,
  Mail, Phone, MapPin, Clock,
  ShieldCheck, Truck, RotateCcw, Star, Zap,
  ChevronRight, Send,
} from 'lucide-react';

import { SHOP_INFO, PLATFORM_INFO, PAYMENT_BADGES, formatPhoneDisplay } from '../../config/store';
import { slugify } from '../../utils/slugify';
import ApexoraWordmark from './ApexoraWordmark';
import { CONSOLE_URL, isMarketplace } from '../../api/dataSource';
import { localizedPick } from '../../api/marketplaceAdapters';
import useMarketplaceCategories from '../../hooks/useMarketplaceCategories';

export default function Footer() {
  const { t, i18n } = useTranslation('footer');
  const { t: tPlatform } = useTranslation('platform');
  const { t: tMarket } = useTranslation('marketplace');
  const marketplaceCategories = useMarketplaceCategories();
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
  // Marketplace mode (follow-up #2): "Secure Payments" and "100% Genuine
  // Parts" are claims Apexora can't actually back for every third-party
  // seller — swapped for wording that's true today. pos mode's own badges
  // (footer.json, untouched) are a single shop's first-party claim about
  // its own stock, which is a different, legitimate thing to say.
  const trustBadges = isMarketplace ? [
    { icon: <ShieldCheck size={18} />, label: tMarket('trust.cashOnDelivery'),   color: '#10b981' },
    { icon: <Truck size={18} />,       label: t('trust.islandwideDelivery'),     color: '#e67e22' },
    { icon: <RotateCcw size={18} />,   label: t('trust.easyReturns'),            color: '#f59e0b' },
    { icon: <Star size={18} />,        label: tMarket('trust.qualityCheckedSellers'), color: '#ec4899' },
    { icon: <Zap size={18} />,         label: t('trust.fastProcessing'),         color: '#14b8a6' },
  ] : [
    { icon: <ShieldCheck size={18} />, label: t('trust.securePayments'),      color: '#10b981' },
    { icon: <Truck size={18} />,       label: t('trust.islandwideDelivery'),  color: '#e67e22' },
    { icon: <RotateCcw size={18} />,   label: t('trust.easyReturns'),         color: '#f59e0b' },
    { icon: <Star size={18} />,        label: t('trust.genuineParts'),        color: '#ec4899' },
    { icon: <Zap size={18} />,         label: t('trust.fastProcessing'),      color: '#14b8a6' },
  ];

  // Marketplace mode (follow-up #5): the pos-mode links below point at a
  // fixed set of POS category slugs that don't exist under the real,
  // admin-managed category tree (real ones look like
  // "vehicle-parts-three-wheel", not "three-wheel") — every one of these
  // 404'd. Built from real categories instead, and "Track My Order"
  // dropped entirely: there's no real order to track yet (marketplace
  // checkout is still the Part A "coming soon" message), so the link had
  // nowhere real to go, same reasoning as hiding "My Orders" from the
  // main nav (StoreLayout.jsx).
  const quickLinks = isMarketplace
    ? marketplaceCategories.slice(0, 4).map((c) => ({ label: localizedPick(c.name, i18n.language), to: `/category/${c.slug}` }))
    : [
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
    { label: tPlatform('ourStores'),             to: '/store/mudiyanse-auto-solutions' },
    { label: t('support.deliveryInformation'),   to: '/delivery' },
    { label: t('support.returnRefundPolicy'),    to: '/returns' },
    { label: t('support.privacyPolicy'),         to: '/privacy' },
    { label: t('support.termsConditions'),       to: '/terms' },
  ];

  // Milestone 5 Part D.8 — links to the console app's public /apply page,
  // not anywhere within this app itself. Hidden when VITE_CONSOLE_URL
  // isn't set (e.g. production until that's deliberately configured),
  // same "don't render a dead link" rule as WHATSAPP_NUMBER above.
  const sellOnApexoraHref = CONSOLE_URL ? `${CONSOLE_URL}/apply` : null;

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
            {/* Platform wordmark — see the same note in StoreLayout.jsx */}
            <div style={{ marginBottom: '18px' }}>
              <ApexoraWordmark size={24} />
            </div>

            {/* Milestone 6 — "quality vehicle parts" in marketplace mode,
                softer than pos mode's "genuine vehicle parts" (a single
                shop's own first-party claim, left unchanged). */}
            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.75, marginBottom: '20px', maxWidth: '290px' }}>
              {isMarketplace ? tMarket('footerTagline') : tPlatform('footerTagline')}
            </p>

            {/* A star rating/review count was here — removed (follow-up
                #2): it was always a hardcoded "4.9 (200+ reviews)", never
                real review data, and the platform has no reviews yet.
                Never show a rating that isn't backed by real data. */}

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
            {/* h2, not h3 — on a page whose only other level-2+ heading
                is inside a closed mobile filter drawer (not in the DOM
                until opened, e.g. CategoryPage*.jsx's "Filters" h2),
                the footer's heading was the first one actually present
                on load, and h3 right after the page's h1 skips a level.
                Going from a deeper heading (h3) down to h2 is always
                fine per the heading-order rule — only skipping FORWARD
                is flagged — so this is safe on every other page too,
                never just this one. Purely a tag change: sectionHeading()
                is a fully inline style object, no tag-dependent default
                styling, so this is visually identical. */}
            <h2 style={sectionHeading('#e67e22')}>{t('quickShop.heading')}</h2>
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
            <h2 style={sectionHeading('#8b5cf6')}>{t('support.heading')}</h2>
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
            {sellOnApexoraHref && (
              <a
                href={sellOnApexoraHref} target="_blank" rel="noopener noreferrer"
                style={navLink.base}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.paddingLeft = '5px'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.paddingLeft = '0'; }}
              >
                <ChevronRight size={13} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                {t('support.sellOnApexora')}
              </a>
            )}
          </div>

          {/* ── Contact + Newsletter ── */}
          <div>
            <h2 style={sectionHeading('#10b981')}>{t('contact.heading')}</h2>

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
                // Not the brand #25d366 — white text on that only reaches
                // 1.98:1 (fails WCAG AA's 4.5:1). Darkened just for this
                // button background; the icon elsewhere keeps the real
                // brand green since icon color isn't a text-contrast rule.
                background: '#128037', color: 'white', textDecoration: 'none',
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
                    aria-label={t('newsletter.subscribe')}
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
              <strong style={{ color: 'var(--text-secondary)' }}>{PLATFORM_INFO.name}</strong>
              {'. '}{t('bottomBar.rights')}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {tPlatform('footerOperatedBy', { platform: PLATFORM_INFO.name, operator: PLATFORM_INFO.operatedBy, brNumber: PLATFORM_INFO.operatorBr })}
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