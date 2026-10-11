// Injects the Google Fonts <link> for a language's script on first use only
// — English never loads either font; switching to si/ta for the first time
// in a session fetches exactly one stylesheet, never both. font-display:swap
// keeps text visible (in the fallback font) while it loads instead of
// blocking render.
const FONT_HREF = {
  si: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700;800;900&display=swap',
  ta: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800;900&display=swap',
};

const loaded = new Set();

export function ensureFontLoaded(lang) {
  const href = FONT_HREF[lang];
  if (!href || loaded.has(lang)) return;
  loaded.add(lang);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.lang = lang;
  document.head.appendChild(link);
}
