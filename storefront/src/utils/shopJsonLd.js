import { SHOP_INFO, PLATFORM_INFO } from '../config/store';

// schema.org AutoPartsStore markup for one seller — used on /contact (the
// seller's own contact details) and /store/:slug (that seller's store
// page), not the home page anymore now that the site is the Apexora
// marketplace rather than this one seller's own site. Kept as a function
// (not a constant) so it always reads the live window.location.origin
// rather than baking in a stale one.
export function buildShopJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoPartsStore',
    name: SHOP_INFO.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SHOP_INFO.addressLines.join(', '),
      addressLocality: 'Mirigama',
      addressRegion: SHOP_INFO.province,
      addressCountry: 'LK',
    },
    telephone: `+94${SHOP_INFO.phones[0].slice(1)}`,
    email: SHOP_INFO.email,
    openingHours: 'Mo-Su 10:00-22:00',
    url: typeof window !== 'undefined' ? window.location.origin : '',
    hasMap: SHOP_INFO.mapsUrl,
  };
}

// schema.org Organization/OnlineStore markup for the Apexora platform
// itself — used on the home page. Distinct from buildShopJsonLd(): this
// describes the marketplace, not any one seller on it.
export function buildPlatformJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: PLATFORM_INFO.name,
    description: PLATFORM_INFO.tagline,
    url: typeof window !== 'undefined' ? window.location.origin : '',
    email: PLATFORM_INFO.supportEmail,
    telephone: `+94${PLATFORM_INFO.supportPhones[0].slice(1)}`,
    areaServed: 'LK',
  };
}
