import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ensureFontLoaded } from './loadFonts';

import enCommon from '../locales/en/common.json';
import enCart from '../locales/en/cart.json';
import enProduct from '../locales/en/product.json';
import enCategory from '../locales/en/category.json';
import enOrder from '../locales/en/order.json';
import enCheckout from '../locales/en/checkout.json';
import enAuth from '../locales/en/auth.json';
import enFooter from '../locales/en/footer.json';

import siCommon from '../locales/si/common.json';
import siCart from '../locales/si/cart.json';
import siProduct from '../locales/si/product.json';
import siCategory from '../locales/si/category.json';
import siOrder from '../locales/si/order.json';
import siCheckout from '../locales/si/checkout.json';
import siAuth from '../locales/si/auth.json';
import siFooter from '../locales/si/footer.json';

import taCommon from '../locales/ta/common.json';
import taCart from '../locales/ta/cart.json';
import taProduct from '../locales/ta/product.json';
import taCategory from '../locales/ta/category.json';
import taOrder from '../locales/ta/order.json';
import taCheckout from '../locales/ta/checkout.json';
import taAuth from '../locales/ta/auth.json';
import taFooter from '../locales/ta/footer.json';

export const SUPPORTED_LANGUAGES = ['en', 'si', 'ta'];
const STORAGE_KEY = 'storefrontLanguage';

// Bundling all three languages' JSON directly (rather than fetching over
// HTTP via i18next-http-backend) keeps this to the two allowed new
// dependencies — the JSON itself is tiny next to the fonts, which *are*
// loaded on demand (see loadFonts.js), satisfying the "only load what's
// needed" requirement where it actually matters for page weight.
const resources = {
  en: { common: enCommon, cart: enCart, product: enProduct, category: enCategory, order: enOrder, checkout: enCheckout, auth: enAuth, footer: enFooter },
  si: { common: siCommon, cart: siCart, product: siProduct, category: siCategory, order: siOrder, checkout: siCheckout, auth: siAuth, footer: siFooter },
  ta: { common: taCommon, cart: taCart, product: taProduct, category: taCategory, order: taOrder, checkout: taCheckout, auth: taAuth, footer: taFooter },
};

function getStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeLanguage(lng) {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // localStorage unavailable (private mode, disabled) — language choice
    // just won't survive a refresh this session, nothing else breaks.
  }
}

// Whether a visitor has already made an explicit language choice (used to
// decide whether to show the first-visit banner) — distinct from "has a
// saved preference" so a dismiss-without-choosing is also remembered.
const BANNER_DISMISSED_KEY = 'storefrontLanguageBannerDismissed';
export function hasSeenLanguageBanner() {
  try {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === '1' || !!getStoredLanguage();
  } catch {
    return false;
  }
}
export function dismissLanguageBanner() {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY, '1');
  } catch {
    // Same as storeLanguage — fine if it doesn't persist.
  }
}

i18next.use(initReactI18next).init({
  resources,
  lng: getStoredLanguage() || 'en',
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  ns: ['common', 'cart', 'product', 'category', 'order', 'checkout', 'auth', 'footer'],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
  returnEmptyString: false,
});

// Initial load (including a refresh landing straight on a saved si/ta
// preference) and every subsequent in-session switch both go through here,
// so <html lang> and on-demand font loading never fall out of sync with
// the active language.
function syncDocumentToLanguage(lng) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  ensureFontLoaded(lng);
}
syncDocumentToLanguage(i18next.language);
i18next.on('languageChanged', syncDocumentToLanguage);

// Switching `<html lang>` immediately flips index.css's font-family/
// line-height rule for the new language. With font-display: swap, the page
// briefly renders in the fallback font before the real Sinhala/Tamil font
// finishes downloading and swaps in — and that transient reflow can be
// short enough to clamp window.scrollY down (the browser won't scroll past
// the bottom of a momentarily-shorter page), with no automatic restore
// once the page grows back. Found via an actual scroll-position test, not
// speculatively: a plain i18next.changeLanguage() call reproducibly
// dropped scrollY from 400 to 0. Restoring the saved position after both
// the React re-render (rAF) and the font swap (a short delay after) fixes
// it without needing to block the switch on the font loading first.
export function changeLanguagePreservingScroll(lng) {
  const y = typeof window !== 'undefined' ? window.scrollY : 0;
  i18next.changeLanguage(lng);
  if (typeof window === 'undefined') return;
  const restore = () => window.scrollTo(0, y);
  requestAnimationFrame(restore);
  setTimeout(restore, 300);
}

export default i18next;
