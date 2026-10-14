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
import enAbout from '../locales/en/about.json';
import enContact from '../locales/en/contact.json';
import enDelivery from '../locales/en/delivery.json';
import enReturns from '../locales/en/returns.json';
import enPrivacy from '../locales/en/privacy.json';
import enTerms from '../locales/en/terms.json';
import enPwa from '../locales/en/pwa.json';
import enPlatform from '../locales/en/platform.json';

export const SUPPORTED_LANGUAGES = ['en', 'si', 'ta'];
const NAMESPACES = ['common', 'cart', 'product', 'category', 'order', 'checkout', 'auth', 'footer', 'about', 'contact', 'delivery', 'returns', 'privacy', 'terms', 'pwa', 'platform'];
const STORAGE_KEY = 'storefrontLanguage';

// English stays a static/eager import, unlike si/ta below — it's both the
// fallback language (fallbackLng needs it regardless of the active
// language) and, per the language-banner default, the common case for a
// first visit. An earlier version lazy-loaded all three languages
// including English; measured against Lighthouse's Slow-4G profile, that
// made the common case *worse* (FCP 3.2s -> 4.1s, Speed Index 4.4s -> 6.6s)
// because first render had to wait on a fresh round trip to fetch 14 tiny
// JSON chunks before React could mount at all, even though total bytes
// shipped went down. Keeping English eager removes that wait for the
// majority case while si/ta — genuinely optional, chosen by a minority of
// sessions — stay lazy: that's where "only the active language's JSON"
// actually pays off without costing the default path anything.
const enResources = {
  common: enCommon, cart: enCart, product: enProduct, category: enCategory, order: enOrder, checkout: enCheckout, auth: enAuth, footer: enFooter,
  about: enAbout, contact: enContact, delivery: enDelivery, returns: enReturns, privacy: enPrivacy, terms: enTerms, pwa: enPwa, platform: enPlatform,
};

// Lazy by default (no `{ eager: true }`) — si/ta are code-split into their
// own per-namespace chunks, fetched only when loadLanguage() below is
// actually called (first switch to that language, or a saved si/ta
// preference found at boot).
const localeLoaders = import.meta.glob('../locales/{si,ta}/*.json');

const loadedLanguages = new Set(['en']);

async function loadLanguage(lng) {
  if (loadedLanguages.has(lng)) return;
  const modules = await Promise.all(
    NAMESPACES.map((ns) => localeLoaders[`../locales/${lng}/${ns}.json`]())
  );
  NAMESPACES.forEach((ns, i) => {
    i18next.addResourceBundle(lng, ns, modules[i].default, true, true);
  });
  loadedLanguages.add(lng);
}

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

// Initial load (including a refresh landing straight on a saved si/ta
// preference) and every subsequent in-session switch both go through here,
// so <html lang> and on-demand font loading never fall out of sync with
// the active language.
function syncDocumentToLanguage(lng) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  ensureFontLoaded(lng);
}

// Called once from main.jsx before the first render. English resources are
// already in hand synchronously; a saved si/ta preference is the one case
// that awaits a network round trip before the first render (see the note
// on enResources above for why that trade-off is the right way round).
export async function initI18n() {
  const initialLang = getStoredLanguage() || 'en';

  await i18next.use(initReactI18next).init({
    resources: { en: enResources },
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: NAMESPACES,
    defaultNS: 'common',
    interpolation: { escapeValue: false }, // React already escapes
    returnEmptyString: false,
  });

  if (initialLang !== 'en') {
    await loadLanguage(initialLang);
    await i18next.changeLanguage(initialLang);
  }

  syncDocumentToLanguage(i18next.language);
  i18next.on('languageChanged', syncDocumentToLanguage);
}

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
export async function changeLanguagePreservingScroll(lng) {
  const y = typeof window !== 'undefined' ? window.scrollY : 0;
  await loadLanguage(lng);
  i18next.changeLanguage(lng);
  if (typeof window === 'undefined') return;
  const restore = () => window.scrollTo(0, y);
  requestAnimationFrame(restore);
  setTimeout(restore, 300);
}

export default i18next;
