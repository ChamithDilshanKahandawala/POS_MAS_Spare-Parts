import { SHOP_INFO } from '../config/store';

// schema.org AutoPartsStore markup, shared by the home and contact pages
// (see useJsonLd.js). Kept as a function (not a constant) so it always
// reads the live window.location.origin rather than baking in a stale one.
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
