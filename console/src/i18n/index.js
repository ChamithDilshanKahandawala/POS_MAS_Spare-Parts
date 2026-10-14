import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';
import siCommon from '../locales/si/common.json';
import siAuth from '../locales/si/auth.json';
import taCommon from '../locales/ta/common.json';
import taAuth from '../locales/ta/auth.json';

export const SUPPORTED_LANGUAGES = ['en', 'si', 'ta'];
const STORAGE_KEY = 'consoleLanguage';

function getStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

// Console is a small, internal tool (unlike the storefront's public,
// bandwidth-sensitive audience) — all three languages are eager-loaded
// up front rather than lazy-loaded per switch. Simpler, and the total
// payload for two namespaces x 3 languages is trivial.
i18next.use(initReactI18next).init({
  lng: getStoredLanguage() || 'en',
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  ns: ['common', 'auth'],
  defaultNS: 'common',
  resources: {
    en: { common: enCommon, auth: enAuth },
    si: { common: siCommon, auth: siAuth },
    ta: { common: taCommon, auth: taAuth },
  },
  interpolation: { escapeValue: false },
});

export function setLanguage(lng) {
  i18next.changeLanguage(lng);
  try { localStorage.setItem(STORAGE_KEY, lng); } catch { /* storage unavailable — language choice just won't persist */ }
  document.documentElement.lang = lng;
}

document.documentElement.lang = i18next.language;

export default i18next;
